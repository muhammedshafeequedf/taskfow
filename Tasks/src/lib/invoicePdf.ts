import { jsPDF } from 'jspdf';
import type { BillingInvoice, BillingInvoiceLine } from './api';
import { billingTypeLabel } from './billingLineUtils';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function refName(
  ref: string | { _id?: string; name?: string; title?: string; contactEmail?: string } | undefined,
  fallback = '—'
): string {
  if (!ref) return fallback;
  if (typeof ref === 'string') return fallback;
  return ref.name || ref.title || fallback;
}

function fmtDate(d?: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString();
}

function periodCell(line: BillingInvoiceLine): string {
  const from = line.periodStart ? fmtDate(line.periodStart) : '';
  const to = line.periodEnd ? fmtDate(line.periodEnd) : '';
  if (from && to) return `${from} – ${to}`;
  return from || to || '—';
}

function qtyCell(line: BillingInvoiceLine): string {
  const type = line.billingType ?? 'fixed';
  if (type === 'hourly' || type === 'support') return `${line.quantity} hrs`;
  if (type === 'retainer' || type === 'amc') return `${line.quantity} mo`;
  return String(line.quantity);
}

function rateCell(line: BillingInvoiceLine, currency: string): string {
  const type = line.billingType ?? 'fixed';
  if (type === 'hourly' || type === 'support') return `${money(line.unitPrice, currency)}/hr`;
  if (type === 'retainer' || type === 'amc') return `${money(line.unitPrice, currency)}/mo`;
  return money(line.unitPrice, currency);
}

export function buildInvoicePdf(invoice: BillingInvoice, companyName?: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;
  const currency = invoice.currency || 'USD';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyName || 'Invoice', margin, y);

  doc.setFontSize(14);
  doc.text('INVOICE', pageW - margin, y, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);

  const billToX = margin;
  const metaX = pageW - margin - 55;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  doc.text('Bill to', billToX, y);
  doc.text('Invoice details', metaX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.text(refName(invoice.accountId), billToX, y);
  doc.text(`# ${invoice.number}`, metaX, y);
  y += 4.5;

  const customerOrg = invoice.customerOrgId;
  if (customerOrg && typeof customerOrg === 'object' && customerOrg.contactEmail) {
    doc.text(customerOrg.contactEmail, billToX, y);
    y += 4.5;
  }

  doc.text(`Issue date: ${fmtDate(invoice.issueDate)}`, metaX, y);
  y += 4.5;

  if (invoice.dueDate) {
    doc.text(`Due date: ${fmtDate(invoice.dueDate)}`, metaX, y);
    y += 4.5;
  }
  if (invoice.paymentTerms) {
    doc.text(`Terms: ${invoice.paymentTerms}`, metaX, y);
    y += 4.5;
  }
  if (invoice.poNumber) {
    doc.text(`PO: ${invoice.poNumber}`, metaX, y);
    y += 4.5;
  }
  if (invoice.servicePeriodStart || invoice.servicePeriodEnd) {
    const sp =
      invoice.servicePeriodStart && invoice.servicePeriodEnd
        ? `${fmtDate(invoice.servicePeriodStart)} – ${fmtDate(invoice.servicePeriodEnd)}`
        : fmtDate(invoice.servicePeriodStart || invoice.servicePeriodEnd);
    doc.text(`Service period: ${sp}`, metaX, y);
    y += 4.5;
  }

  if (invoice.projectId) {
    doc.text(`Project: ${refName(invoice.projectId as { name?: string; key?: string })}`, billToX, y);
    y += 4.5;
  }
  if (invoice.contractId) {
    doc.text(`Contract: ${refName(invoice.contractId)}`, billToX, y);
    y += 4.5;
  }

  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40);
  const cols = [
    { label: 'Description', x: margin, w: 52 },
    { label: 'Type', x: margin + 52, w: 24 },
    { label: 'Period', x: margin + 76, w: 28 },
    { label: 'Qty', x: margin + 104, w: 16 },
    { label: 'Rate', x: margin + 120, w: 24 },
    { label: 'Amount', x: margin + 144, w: 22 },
  ];
  for (const c of cols) doc.text(c.label, c.x, y);
  y += 3;
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30);

  const lines = invoice.lines ?? [];
  for (const line of lines) {
    if (y > 265) {
      doc.addPage();
      y = margin;
    }
    const desc = line.category ? `${line.category} — ${line.description}` : line.description;
    const descLines = doc.splitTextToSize(desc, cols[0].w - 2);
    doc.text(descLines, cols[0].x, y);
    doc.text(billingTypeLabel(line.billingType), cols[1].x, y);
    const periodLines = doc.splitTextToSize(periodCell(line), cols[2].w - 2);
    doc.text(periodLines, cols[2].x, y);
    doc.text(qtyCell(line), cols[3].x, y);
    doc.text(rateCell(line, currency), cols[4].x, y);
    doc.text(money(line.amount ?? 0, currency), cols[5].x, y);
    y += Math.max(5, descLines.length * 3.5, periodLines.length * 3.5) + 1;
  }

  y += 4;
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(9);
  const totalsX = pageW - margin;
  const addTotal = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, totalsX - 55, y);
    doc.text(value, totalsX, y, { align: 'right' });
    y += 5.5;
  };

  addTotal('Subtotal', money(invoice.subtotal ?? 0, currency));
  if ((invoice.taxTotal ?? 0) > 0) {
    addTotal(`Tax${invoice.taxCode ? ` (${invoice.taxCode})` : ''}`, money(invoice.taxTotal ?? 0, currency));
  }
  const balance = Math.round(((invoice.total ?? 0) - (invoice.amountPaid ?? 0)) * 100) / 100;
  addTotal('Total', money(invoice.total ?? 0, currency), true);
  if ((invoice.amountPaid ?? 0) > 0) {
    addTotal('Paid', money(invoice.amountPaid ?? 0, currency));
    addTotal('Amount due', money(balance, currency), true);
  } else {
    addTotal('Amount due', money(invoice.total ?? 0, currency), true);
  }

  if (invoice.notes?.trim()) {
    y += 6;
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes / payment instructions', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60);
    const noteLines = doc.splitTextToSize(invoice.notes.trim(), pageW - 2 * margin);
    doc.text(noteLines, margin, y);
  }

  return doc;
}

export function downloadInvoicePdf(doc: jsPDF, invoiceNumber: string): void {
  const safe = invoiceNumber.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  doc.save(`invoice-${safe}.pdf`);
}

export function downloadInvoicePdfFromInvoice(invoice: BillingInvoice, companyName?: string): void {
  const doc = buildInvoicePdf(invoice, companyName);
  downloadInvoicePdf(doc, invoice.number);
}
