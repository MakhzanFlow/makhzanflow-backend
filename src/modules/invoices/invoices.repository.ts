import { injectable } from "tsyringe";
import { prisma } from "../../database/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateInvoiceInput, AddInvoicePaymentInput } from "../../types/invoices.js";

@injectable()
export class InvoiceRepository {
  async findById(id: string, companyId: string) {
    return prisma.invoices.findFirst({
      where: { id, company_id: companyId },
      include: {
        invoice_items: {
          include: { products: { select: { name: true, image_url: true, price: true } } }
        },
        payments: true,
        customers: true,
        users: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findMany(where: Prisma.invoicesWhereInput, skip: number, take: number, orderBy: Prisma.invoicesOrderByWithRelationInput) {
    return prisma.invoices.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        customers: true,
        payments: true,
        users: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async count(where: Prisma.invoicesWhereInput) {
    return prisma.invoices.count({ where });
  }

  async createTransactional(data: CreateInvoiceInput, userId: string) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this._createTransactionalInternal(data, userId);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          if (attempt < maxRetries - 1) continue;
        }
        throw error;
      }
    }
    throw new AppError(409, "Failed to create invoice after retries", "errors.invoiceConflict");
  }

  private async _createTransactionalInternal(data: CreateInvoiceInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const prefix = `INV-${dateStr}-`;
      const lastInvoice = await tx.invoices.findFirst({
        where: {
          company_id: data.company_id,
          invoice_number: { startsWith: prefix },
        },
        orderBy: { invoice_number: "desc" },
      });
      let seq = 1;
      if (lastInvoice) {
        const parts = lastInvoice.invoice_number.split("-");
        const lastSeq = parseInt(parts[2] || "0", 10);
        if (!isNaN(lastSeq)) {
          seq = lastSeq + 1;
        }
      }
      const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;

      const productIds = data.items.map((i) => i.product_id);
      await tx.$queryRaw`SELECT id FROM products WHERE id IN (${Prisma.join(productIds)}) AND company_id = ${data.company_id} FOR UPDATE`;
      const products = await tx.products.findMany({
        where: { id: { in: productIds }, company_id: data.company_id },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const itemsToCreate: Array<{
        product_id: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        previousStock: number;
      }> = [];

      for (const item of data.items) {
        const product = productMap.get(item.product_id);
        if (!product) {
          throw new AppError(404, `Product not found: ${item.product_id}`, "errors.productNotFound");
        }
        if (!product.is_active) {
          throw new AppError(400, `Product ${product.name} is inactive`, "errors.productInactive");
        }
        if (product.stock < item.quantity) {
          throw new AppError(400, `Insufficient stock for product ${product.name}`, "errors.insufficientStock");
        }

        const unitPrice = item.unit_price !== undefined ? item.unit_price : Number(product.price);
        const itemTotal = item.quantity * unitPrice;
        subtotal += itemTotal;

        itemsToCreate.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: itemTotal,
          previousStock: product.stock,
        });
      }

      const totalAmount = Math.max(0, subtotal - (data.discount_amount || 0) + (data.tax_amount || 0));
      const paidAmount = data.payment ? data.payment.amount : 0;

      if (paidAmount > totalAmount) {
        throw new AppError(400, "Payment amount cannot exceed invoice total", "errors.paymentExceedsTotal");
      }

      let status: "paid" | "partially_paid" | "pending" = "pending";
      if (paidAmount >= totalAmount && totalAmount > 0) {
        status = "paid";
      } else if (paidAmount > 0) {
        status = "partially_paid";
      }

      const invoice = await tx.invoices.create({
        data: {
          company_id: data.company_id,
          customer_id: data.customer_id || null,
          invoice_number: invoiceNumber,
          status,
          total_amount: totalAmount,
          discount_amount: data.discount_amount || 0,
          tax_amount: data.tax_amount || 0,
          due_date: data.due_date ? new Date(data.due_date + "T12:00:00.000Z") : null,
          user_id: userId,
        },
      });

      for (const item of itemsToCreate) {
        await tx.invoice_items.create({
          data: {
            invoice_id: invoice.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          },
        });

        await tx.products.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.inventory_logs.create({
          data: {
            product_id: item.product_id,
            user_id: userId,
            action: "sale",
            quantity: item.quantity,
            previous_stock: item.previousStock,
            new_stock: item.previousStock - item.quantity,
            notes: `Sale - Invoice #${invoiceNumber}`,
          },
        });
      }

      if (paidAmount > 0 && data.payment) {
        await tx.payments.create({
          data: {
            invoice_id: invoice.id,
            amount: paidAmount,
            method: data.payment.method,
            reference_number: data.payment.reference_number || null,
            notes: data.payment.notes || null,
          },
        });
      }

      return invoice;
    });
  }

  async addPaymentTransactional(invoiceId: string, companyId: string, input: AddInvoicePaymentInput) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} AND company_id = ${companyId} FOR UPDATE`;

      const invoice = await tx.invoices.findFirst({
        where: { id: invoiceId, company_id: companyId },
        include: { payments: true },
      });

      if (!invoice) {
        throw new AppError(404, "Invoice not found", "errors.invoiceNotFound");
      }
      if (invoice.status === "canceled") {
        throw new AppError(400, "Cannot add payment to a canceled invoice", "errors.invoiceCanceled");
      }

      const totalAmount = Number(invoice.total_amount);
      const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Math.max(0, totalAmount - totalPaid);

      if (remaining <= 0) {
        throw new AppError(400, "Invoice is already fully paid", "errors.invoiceAlreadyPaid");
      }
      if (input.amount > remaining) {
        throw new AppError(
          400,
          `Payment amount (${input.amount}) exceeds remaining amount (${remaining})`,
          "errors.paymentExceedsRemaining"
        );
      }

      await tx.payments.create({
        data: {
          invoice_id: invoiceId,
          amount: input.amount,
          method: input.method,
          reference_number: input.reference_number || null,
          notes: input.notes || null,
        },
      });

      const newTotalPaid = totalPaid + input.amount;
      const newStatus = newTotalPaid >= totalAmount ? "paid" : "partially_paid";

      return tx.invoices.update({
        where: { id: invoiceId },
        data: { status: newStatus },
        include: {
          invoice_items: { include: { products: { select: { name: true, image_url: true, price: true } } } },
          payments: true,
          customers: true,
          users: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async cancelTransactional(invoiceId: string, companyId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} AND company_id = ${companyId} FOR UPDATE`;

      const invoice = await tx.invoices.findFirst({
        where: { id: invoiceId, company_id: companyId },
        include: { invoice_items: true },
      });

      if (!invoice) {
        throw new AppError(404, "Invoice not found", "errors.invoiceNotFound");
      }
      if (invoice.status === "canceled") {
        throw new AppError(400, "Invoice is already canceled", "errors.invoiceAlreadyCanceled");
      }

      for (const item of invoice.invoice_items) {
        if (!item.product_id) continue;
        const product = await tx.products.findFirst({
          where: { id: item.product_id, company_id: companyId },
        });

        if (product) {
          await tx.products.update({
            where: { id: item.product_id },
            data: { stock: { increment: item.quantity } },
          });

          await tx.inventory_logs.create({
            data: {
              product_id: item.product_id,
              user_id: userId,
              action: "return",
              quantity: item.quantity,
              previous_stock: product.stock,
              new_stock: product.stock + item.quantity,
              notes: `Cancellation - Invoice #${invoice.invoice_number}`,
            },
          });
        }
      }

      return tx.invoices.update({
        where: { id: invoiceId },
        data: { status: "canceled" },
        include: {
          invoice_items: { include: { products: { select: { name: true, image_url: true, price: true } } } },
          payments: true,
          customers: true,
          users: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }
}
