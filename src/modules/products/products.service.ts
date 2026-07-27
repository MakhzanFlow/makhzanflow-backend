import { injectable, inject } from "tsyringe";
import { ProductRepository } from "./products.repository.js";
import { ActivityLogService } from "../activity-logs/activity-logs.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductParams,
} from "./products.types.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client.js";

@injectable()
export class ProductService {
  constructor(
    @inject(ProductRepository) private productRepository: ProductRepository,
    @inject(ActivityLogService) private activityLogService: ActivityLogService
  ) {}

  async create(data: CreateProductInput, userId: string) {
    const productData: Prisma.productsUncheckedCreateInput = {
      name: data.name,
      sku: data.sku ?? await this.generateSku(data.company_id),
      barcode: data.barcode ?? null,
      price: data.price,
      cost: data.cost ?? 0,
      stock: data.stock ?? 0,
      min_stock: data.min_stock ?? 0,
      expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
      is_active: data.is_active ?? true,
      company_id: data.company_id,
    };

    const product = await this.productRepository.create(productData).catch((err) => this.handleUniqueError(err));

    await this.activityLogService.log({
      company_id: data.company_id,
      user_id: userId,
      entity: "product",
      entity_id: product.id,
      action: "create",
    });

    return product;
  }

  async findById(id: string, companyId: string) {
    const product = await this.productRepository.findById(id, companyId);
    if (!product) {
      throw new AppError(404, "Product not found", "errors.productNotFound");
    }
    return product;
  }

  async list(params: ListProductParams) {
    const { companyId, page, limit, search, sort, order, low_stock, expiry_before, expiry_after, is_active } = params;
    const skip = (page - 1) * limit;

    if (low_stock === true) {
      const filters = {
        companyId,
        skip,
        take: limit,
        sort: sort ?? "name",
        order: order ?? "asc",
        search: search ?? undefined,
        expiry_before: expiry_before ? new Date(expiry_before) : undefined,
        expiry_after: expiry_after ? new Date(expiry_after) : undefined,
        is_active: is_active ?? undefined,
      };
      const [products, total] = await Promise.all([
        this.productRepository.findLowStock(filters),
        this.productRepository.countLowStock(filters),
      ]);
      return {
        data: products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    }

    const where: Prisma.productsWhereInput = { company_id: companyId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (expiry_before) {
      where.expiry_date = { ...(where.expiry_date as object || {}), lte: new Date(expiry_before) };
    }

    if (expiry_after) {
      where.expiry_date = { ...(where.expiry_date as object || {}), gte: new Date(expiry_after) };
    }

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const orderBy = { [sort ?? "name"]: order ?? "asc" } as Prisma.productsOrderByWithRelationInput;
    const [products, total] = await Promise.all([
      this.productRepository.findAll(where, skip, limit, orderBy),
      this.productRepository.countAll(where),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, companyId: string, data: UpdateProductInput, userId: string) {
    const existing = await this.productRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, "Product not found", "errors.productNotFound");
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku ?? null;
    if (data.barcode !== undefined) updateData.barcode = data.barcode ?? null;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.cost !== undefined) updateData.cost = data.cost;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.min_stock !== undefined) updateData.min_stock = data.min_stock;
    if (data.expiry_date !== undefined) {
      updateData.expiry_date = data.expiry_date ? new Date(data.expiry_date) : null;
    }
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const product = await this.productRepository.update(id, companyId, updateData).catch((err) => this.handleUniqueError(err));

    await this.activityLogService.log({
      company_id: companyId,
      user_id: userId,
      entity: "product",
      entity_id: id,
      action: "update",
      changes: { old: existing, new: product },
    });

    return product;
  }

  async delete(id: string, companyId: string, userId: string) {
    const existing = await this.productRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, "Product not found", "errors.productNotFound");
    }

    const refCount = await this.productRepository.countInvoiceReferences(id);
    if (refCount > 0) {
      throw new AppError(
        400,
        "Cannot delete product that is referenced in invoices",
        "errors.productHasInvoiceReferences"
      );
    }

    await this.productRepository.delete(id, companyId);

    await this.activityLogService.log({
      company_id: companyId,
      user_id: userId,
      entity: "product",
      entity_id: id,
      action: "delete",
    });
  }

  private async generateSku(companyId: string): Promise<string> {
    const prefix = "PRD";
    const shortId = companyId.replace(/-/g, "").slice(0, 6).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sku = `${prefix}-${shortId}-${timestamp}${random}`;

    const existing = await this.productRepository.findBySku(sku, companyId);
    if (existing) {
      return this.generateSku(companyId);
    }
    return sku;
  }

  private handleUniqueError(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const fields = (error.meta?.target as string[])?.join(", ") ?? "";
      if (fields.includes("sku")) {
        throw new AppError(409, "A product with this SKU already exists", "errors.productSkuExists");
      }
      if (fields.includes("barcode")) {
        throw new AppError(409, "A product with this barcode already exists", "errors.productBarcodeExists");
      }
      throw new AppError(409, "A product with these details already exists", "errors.productDuplicate");
    }
    throw error;
  }

  async uploadImage(id: string, companyId: string, imageUrl: string, userId: string) {
    const existing = await this.productRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, "Product not found", "errors.productNotFound");
    }

    const product = await this.productRepository.update(id, companyId, {
      image_url: imageUrl,
    });

    await this.activityLogService.log({
      company_id: companyId,
      user_id: userId,
      entity: "product",
      entity_id: id,
      action: "update",
      changes: { old: { image_url: existing.image_url }, new: { image_url: imageUrl } },
    });

    return product;
  }
}
