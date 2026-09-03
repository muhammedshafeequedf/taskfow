import { jsPDF } from 'jspdf';
import type { CrmQuote, CrmQuoteLine } from './api';

/** jsPDF Helvetica cannot render many currency glyphs (e.g. ₹) — use ASCII-safe labels. */
const CURRENCY_PREFIX: Record<string, string> = {
  INR: 'Rs.',
  USD: '$',
  EUR: 'EUR ',
  GBP: 'GBP ',
  AED: 'AED ',
  CAD: 'CAD ',
  AUD: 'AUD ',
  SGD: 'SGD ',
};

function money(n: number, currency: string): string {
  const code = (currency || 'USD').toUpperCase();
  const amount = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  const prefix = CURRENCY_PREFIX[code];
  if (prefix) return `${prefix}${formatted}`;
  return `${code} ${formatted}`;
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(d).slice(0, 10);
  }
}

function billingLabel(type?: string): string {
  if (type === 'hourly') return 'Hourly';
  if (type === 'milestone') return 'Milestone';
  return 'Fixed';
}

function lineNet(line: CrmQuoteLine): number {
  if (typeof line.amount === 'number' && !Number.isNaN(line.amount)) return line.amount;
  const qty = line.billingType === 'milestone' ? 1 : Math.max(0, line.quantity || 0);
  const gross = qty * Math.max(0, line.unitPrice || 0);
  const disc = Math.min(100, Math.max(0, line.discountPercent || 0));
  return Math.round(gross * (1 - disc / 100) * 100) / 100;
}

function qtyCell(line: CrmQuoteLine): string {
  if (line.billingType === 'hourly') return `${line.quantity} hrs`;
  return String(line.quantity ?? 0);
}

function rateCell(line: CrmQuoteLine, currency: string): string {
  if (line.billingType === 'hourly') return `${money(line.unitPrice ?? 0, currency)}/hr`;
  return money(line.unitPrice ?? 0, currency);
}

function customerBlock(quote: CrmQuote): {
  name: string;
  lines: string[];
} {
  const account =
    quote.accountId && typeof quote.accountId === 'object' ? quote.accountId : null;
  const org =
    quote.customerOrgId && typeof quote.customerOrgId === 'object' ? quote.customerOrgId : null;
  const lead = quote.leadId && typeof quote.leadId === 'object' ? quote.leadId : null;

  const name =
    org?.name ||
    account?.name ||
    lead?.companyName ||
    lead?.title ||
    (typeof quote.accountId === 'string' ? 'Customer' : '—');

  const lines: string[] = [];
  if (lead?.contactName) lines.push(lead.contactName);
  if (lead?.contactEmail) lines.push(lead.contactEmail);
  if (org && 'contactEmail' in org && (org as { contactEmail?: string }).contactEmail) {
    lines.push(String((org as { contactEmail?: string }).contactEmail));
  }
  if (account?.industry) lines.push(account.industry);
  if (account?.website) lines.push(account.website);
  if (lead?.companyName && lead?.title && lead.companyName !== name) {
    lines.push(`Opportunity: ${lead.title}`);
  }

  return { name, lines };
}

function ensureSpace(doc: jsPDF, y: number, need: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need <= pageH - margin) return y;
  doc.addPage();
  return margin;
}

function drawTableHeader(
  doc: jsPDF,
  cols: Array<{ label: string; x: number; w: number; align?: 'left' | 'right' }>,
  y: number,
  pageW: number,
  margin: number
): number {
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y - 4, pageW - 2 * margin, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60);
  for (const c of cols) {
    doc.text(c.label, c.align === 'right' ? c.x + c.w : c.x, y, {
      align: c.align === 'right' ? 'right' : 'left',
    });
  }
  y += 3;
  doc.setDrawColor(210);
  doc.line(margin, y, pageW - margin, y);
  return y + 5;
}

export function buildQuotePdf(quote: CrmQuote, companyName?: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;
  const currency = quote.currency || 'USD';
  const customer = customerBlock(quote);
  const dealTitle =
    quote.dealId && typeof quote.dealId === 'object' ? quote.dealId.title : undefined;
  const leadTitle =
    quote.leadId && typeof quote.leadId === 'object' ? quote.leadId.title : undefined;
  const lines = quote.lineItems ?? [];
  const totalHours = lines
    .filter((l) => l.billingType === 'hourly')
    .reduce((s, l) => s + (l.quantity || 0), 0);

  // ── Header ────────────────────────────────────────────────────────────
  doc.setFillColor(24, 32, 48);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(companyName || 'Quotation', margin, 12);
  doc.setFontSize(18);
  doc.text('QUOTATION', pageW - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(quote.title || 'Untitled quotation', margin, 20);
  doc.text(`Ref: ${quote._id.slice(-8).toUpperCase()}`, pageW - margin, 20, { align: 'right' });
  y = 36;
  doc.setTextColor(30);

  // ── Two-column meta ───────────────────────────────────────────────────
  const leftX = margin;
  const rightX = pageW / 2 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('PREPARED FOR', leftX, y);
  doc.text('QUOTE DETAILS', rightX, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(customer.name, leftX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50);
  const detailRows: Array<[string, string]> = [
    ['Status', (quote.status || 'draft').toUpperCase()],
    ['Version', String(quote.version ?? 1)],
    ['Currency', currency.toUpperCase()],
    ['Issue date', fmtDate(quote.createdAt)],
    ['Valid until', fmtDate(quote.validUntil)],
  ];
  if (dealTitle) detailRows.push(['Deal', dealTitle]);
  if (leadTitle) detailRows.push(['Lead', leadTitle]);
  if (totalHours > 0) detailRows.push(['Total hours', `${totalHours} hrs`]);

  let metaY = y;
  for (const [label, value] of detailRows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`${label}:`, rightX, metaY);
    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    const valueLines = doc.splitTextToSize(value, pageW / 2 - margin - 28);
    doc.text(valueLines, rightX + 28, metaY);
    metaY += Math.max(5, valueLines.length * 4);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  let custY = y + 5;
  for (const line of customer.lines) {
    const wrapped = doc.splitTextToSize(line, pageW / 2 - margin - 4);
    doc.text(wrapped, leftX, custY);
    custY += wrapped.length * 4;
  }
  if (customer.lines.length === 0 && !accountOrOrgOrLead(quote)) {
    doc.setTextColor(140);
    doc.text('Customer details not linked', leftX, custY);
    custY += 4;
  }

  y = Math.max(metaY, custY) + 6;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Line table ────────────────────────────────────────────────────────
  const cols = [
    { label: '#', x: margin, w: 8, align: 'left' as const },
    { label: 'Description', x: margin + 8, w: 58, align: 'left' as const },
    { label: 'Category', x: margin + 66, w: 22, align: 'left' as const },
    { label: 'Type', x: margin + 88, w: 18, align: 'left' as const },
    { label: 'Qty', x: margin + 106, w: 16, align: 'right' as const },
    { label: 'Rate', x: margin + 122, w: 26, align: 'right' as const },
    { label: 'Amount', x: margin + 148, w: 34, align: 'right' as const },
  ];

  y = drawTableHeader(doc, cols, y, pageW, margin);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30);

  lines.forEach((line, idx) => {
    const desc = line.description || '—';
    const descLines = doc.splitTextToSize(desc, cols[1].w - 1);
    const rowH = Math.max(6, descLines.length * 3.8 + 2);
    y = ensureSpace(doc, y, rowH + 2, margin);
    if (y === margin) {
      y = drawTableHeader(doc, cols, y, pageW, margin);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(margin, y - 3.5, pageW - 2 * margin, rowH, 'F');
    }

    doc.text(String(idx + 1), cols[0].x, y);
    doc.text(descLines, cols[1].x, y);
    doc.text(line.category || '—', cols[2].x, y);
    doc.text(billingLabel(line.billingType), cols[3].x, y);
    doc.text(qtyCell(line), cols[4].x + cols[4].w, y, { align: 'right' });
    doc.text(rateCell(line, currency), cols[5].x + cols[5].w, y, { align: 'right' });
    doc.text(money(lineNet(line), currency), cols[6].x + cols[6].w, y, { align: 'right' });

    const disc = line.discountPercent ?? 0;
    const tax = line.taxRate ?? 0;
    if (disc > 0 || tax > 0) {
      const extras: string[] = [];
      if (disc > 0) extras.push(`Disc ${disc}%`);
      if (tax > 0) extras.push(`Tax ${tax}%`);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(extras.join(' · '), cols[1].x, y + descLines.length * 3.8);
      doc.setFontSize(8);
      doc.setTextColor(30);
      y += rowH + 1;
    } else {
      y += rowH;
    }
  });

  if (lines.length === 0) {
    doc.setTextColor(120);
    doc.text('No line items', margin, y);
    y += 6;
  }

  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Totals ────────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 40, margin);
  const totalsX = pageW - margin;
  const labelX = totalsX - 55;
  const addTotal = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(bold ? 20 : 80);
    doc.text(label, labelX, y);
    doc.text(value, totalsX, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  };

  if (totalHours > 0) {
    addTotal('Total hours', `${totalHours} hrs`);
  }
  addTotal('Subtotal', money(quote.subtotal ?? 0, currency));
  if ((quote.discountAmount ?? 0) > 0) {
    addTotal(
      `Discount${quote.discountPercent ? ` (${quote.discountPercent}%)` : ''}`,
      `-${money(quote.discountAmount ?? 0, currency)}`
    );
  }
  if ((quote.taxTotal ?? 0) > 0) {
    addTotal(
      `Tax${quote.taxCode ? ` (${quote.taxCode})` : ''}`,
      money(quote.taxTotal ?? 0, currency)
    );
  }

  doc.setDrawColor(24, 32, 48);
  doc.setLineWidth(0.4);
  doc.line(labelX, y - 1, totalsX, y - 1);
  y += 5;
  addTotal('Grand total', money(quote.total ?? quote.subtotal ?? 0, currency), true);
  doc.setLineWidth(0.2);

  // ── Notes ─────────────────────────────────────────────────────────────
  if (quote.notes?.trim()) {
    y += 6;
    y = ensureSpace(doc, y, 24, margin);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text('Notes / assumptions', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70);
    const noteLines = doc.splitTextToSize(quote.notes.trim(), pageW - 2 * margin);
    for (const nl of noteLines) {
      y = ensureSpace(doc, y, 5, margin);
      doc.text(nl, margin, y);
      y += 4;
    }
  }

  // ── Footer on each page ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      `${companyName || 'Quotation'} · ${quote.title || 'Quote'} · Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    );
  }

  return doc;
}

function accountOrOrgOrLead(quote: CrmQuote): boolean {
  return Boolean(quote.accountId || quote.customerOrgId || quote.leadId);
}

export function downloadQuotePdf(quote: CrmQuote, companyName?: string): void {
  const doc = buildQuotePdf(quote, companyName);
  const safe = (quote.title || 'quote').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  doc.save(`quote-${safe || quote._id}.pdf`);
}

/** Base64 without data: URL prefix — for email attachment. */
export function quotePdfBase64(quote: CrmQuote, companyName?: string): string {
  const doc = buildQuotePdf(quote, companyName);
  return doc.output('datauristring').split(',')[1] ?? '';
}

export function quotePdfFilename(quote: CrmQuote): string {
  const safe = (quote.title || 'quote').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  return `quote-${safe || quote._id}.pdf`;
}
