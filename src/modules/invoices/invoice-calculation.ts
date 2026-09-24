/** Pure domain math for invoices — no Prisma, no AppError. Used by service (pre-validation) and repository (in-tx authoritative compute under row locks). */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return fromCents(toCents(unitPrice) * quantity);
}

export function computeInvoiceTotal(subtotal: number, discount = 0, tax = 0): number {
  const totalCents = toCents(subtotal) - toCents(discount) + toCents(tax);
  return fromCents(Math.max(0, totalCents));
}

export function resolveInvoiceStatus(totalAmount: number, paidAmount: number): 'paid' | 'partially_paid' | 'pending' {
  if (paidAmount >= totalAmount && totalAmount > 0) return 'paid';
  if (paidAmount > 0) return 'partially_paid';
  return 'pending';
}

export function buildInvoiceNumber(date: Date, seq: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${dateStr}-${String(seq).padStart(4, '0')}`;
}

export function parseInvoiceSeq(invoiceNumber: string): number {
  const parts = invoiceNumber.split('-');
  const lastSeq = parseInt(parts[2] || '0', 10);
  return isNaN(lastSeq) ? 0 : lastSeq;
}
