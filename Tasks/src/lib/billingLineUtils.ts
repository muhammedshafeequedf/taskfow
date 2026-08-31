import type { BillingInvoiceLineType } from './api';

export type InvoiceLineDraft = {
  description: string;
  category: string;
  billingType: BillingInvoiceLineType;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  periodStart: string;
  periodEnd: string;
  hsnSac: string;
};

export const INVOICE_CATEGORIES = ['Frontend', 'Backend', 'Mobile', 'Integration', 'DevOps', 'QA', 'Design', 'Support', 'Other'];

export const INVOICE_LINE_PRESETS: Array<{
  label: string;
  line: Partial<InvoiceLineDraft>;
}> = [
  { label: 'T&M — development hours', line: { description: 'Development services', category: 'Backend', billingType: 'hourly', quantity: 8 } },
  { label: 'Monthly retainer', line: { description: 'Monthly retainer — support & maintenance', category: 'Support', billingType: 'retainer', quantity: 1 } },
  { label: 'AMC annual', line: { description: 'Annual maintenance contract', category: 'Support', billingType: 'amc', quantity: 12 } },
  { label: 'Support block', line: { description: 'Prepaid support block', category: 'Support', billingType: 'support', quantity: 10 } },
  { label: 'Milestone delivery', line: { description: 'Phase delivery milestone', category: 'Other', billingType: 'milestone', quantity: 1 } },
  { label: 'Expense reimbursement', line: { description: 'Reimbursable expense', category: 'Other', billingType: 'expense', quantity: 1 } },
];

export function emptyInvoiceLine(taxRate = 0): InvoiceLineDraft {
  return {
    description: '',
    category: '',
    billingType: 'hourly',
    quantity: 8,
    unitPrice: 0,
    taxRate,
    discountPercent: 0,
    periodStart: '',
    periodEnd: '',
    hsnSac: '',
  };
}

export function invoiceLineAmount(line: InvoiceLineDraft): number {
  const unitary = ['milestone', 'retainer', 'amc'].includes(line.billingType);
  const qty = unitary && !(line.quantity > 0) ? 1 : Math.max(0, line.quantity || 0);
  const gross = qty * Math.max(0, line.unitPrice || 0);
  const discount = Math.min(100, Math.max(0, line.discountPercent || 0));
  return Math.round(gross * (1 - discount / 100) * 100) / 100;
}

export function invoiceLineTax(line: InvoiceLineDraft): number {
  return Math.round(invoiceLineAmount(line) * (Math.max(0, line.taxRate) / 100) * 100) / 100;
}

export function qtyLabel(type: BillingInvoiceLineType): string {
  if (type === 'hourly' || type === 'support') return 'Hours';
  if (type === 'retainer' || type === 'amc') return 'Months';
  if (type === 'milestone') return 'Qty';
  return 'Qty';
}

export function rateLabel(type: BillingInvoiceLineType): string {
  if (type === 'hourly' || type === 'support') return 'Rate / hr';
  if (type === 'retainer' || type === 'amc') return 'Monthly fee';
  if (type === 'milestone') return 'Milestone fee';
  if (type === 'expense') return 'Amount';
  return 'Unit price';
}

export function billingTypeLabel(type?: BillingInvoiceLineType | string): string {
  switch (type) {
    case 'hourly':
      return 'Time & materials';
    case 'fixed':
      return 'Fixed fee';
    case 'milestone':
      return 'Milestone';
    case 'retainer':
      return 'Retainer';
    case 'amc':
      return 'AMC';
    case 'support':
      return 'Support block';
    case 'expense':
      return 'Expense';
    default:
      return 'Fixed fee';
  }
}

export function invoiceTotals(lines: InvoiceLineDraft[]) {
  const subtotal = Math.round(lines.reduce((s, l) => s + invoiceLineAmount(l), 0) * 100) / 100;
  const taxTotal = Math.round(lines.reduce((s, l) => s + invoiceLineTax(l), 0) * 100) / 100;
  return { subtotal, taxTotal, total: Math.round((subtotal + taxTotal) * 100) / 100 };
}

export function linesToPayload(lines: InvoiceLineDraft[]) {
  return lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      description: l.description.trim(),
      category: l.category || undefined,
      billingType: l.billingType,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      discountPercent: l.discountPercent || undefined,
      periodStart: l.periodStart || undefined,
      periodEnd: l.periodEnd || undefined,
      hsnSac: l.hsnSac || undefined,
      amount: invoiceLineAmount(l),
      sourceType: 'manual' as const,
    }));
}

export function lineFromApi(line: {
  description?: string;
  category?: string;
  billingType?: BillingInvoiceLineType;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
  discountPercent?: number;
  periodStart?: string;
  periodEnd?: string;
  hsnSac?: string;
}): InvoiceLineDraft {
  return {
    description: line.description ?? '',
    category: line.category ?? '',
    billingType: line.billingType ?? 'fixed',
    quantity: line.quantity ?? 1,
    unitPrice: line.unitPrice ?? 0,
    taxRate: line.taxRate ?? 0,
    discountPercent: line.discountPercent ?? 0,
    periodStart: line.periodStart ? line.periodStart.slice(0, 10) : '',
    periodEnd: line.periodEnd ? line.periodEnd.slice(0, 10) : '',
    hsnSac: line.hsnSac ?? '',
  };
}
