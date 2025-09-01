import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

const fmtCurrency = (amountInCents = 0, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency })
    .format((amountInCents ?? 0) / 100);

const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString() : '—';

export async function fetchReceipt(orderId) {
  const { data, error } = await supabase.rpc('get_order_receipt', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

// ---- helpers for layout ----------------------------------------------------
const HEADER_BG = [246, 248, 252];
const LABEL_COLOR = [110, 110, 110];
const TEXT_COLOR = [20, 20, 20];
const BORDER_COLOR = [220, 224, 229];
const capFirst = (s) =>
  (typeof s === 'string' && s.length)
    ? s.charAt(0).toUpperCase() + s.slice(1)
    : s;

const extrasFromOptions = (opts = []) =>
  (opts || []).reduce((sum, o) => sum + ((o?.price_cents || 0) * (o?.quantity ?? 1)), 0);

function getPageSize(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  return { w, h };
}

function splitText(doc, text, maxWidth) {
  return doc.splitTextToSize(String(text ?? ''), maxWidth);
}

function divider(doc, { x, y, width }) {
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + width, y);
}

function ensureSpace(doc, y, needed, margin) {
  const { h } = getPageSize(doc);
  if (y + needed > h - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function makeFileName(r) {
  const safeTitle = (r?.title || 'order')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `receipt_${safeTitle}_${String(r?.order_id || '').slice(0, 8)}.pdf`;
}

/** Inline field: Label and value on the same line (label small/grey/bold). */
function drawInlineField(doc, { x, y, label, value, width, gap = 6, afterGap = 10 }) {
  const labelTxt = `${String(label)}:`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...LABEL_COLOR);
  doc.text(labelTxt, x, y);

  const labelW = doc.getTextWidth(labelTxt);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_COLOR);

  const avail = Math.max((width ?? 9999) - labelW - gap, 24);
  const val = String(value ?? '—');
  const lines = splitText(doc, val, avail);

  // first line sits to the right of the label
  doc.text(lines[0] || '—', x + labelW + gap, y);

  // subsequent lines wrap under the whole row
  if (lines.length > 1) {
    const rest = lines.slice(1);
    doc.text(rest, x, y + 12);
  }

  const usedH = 12 + Math.max(0, (lines.length - 1)) * 12;
  return y + usedH + afterGap;
}

/** Label + multiple value lines (e.g., School & Team, Placed By). */
function drawLabelWithLines(doc, { x, y, label, lines = [], width, afterGap = 10 }) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...LABEL_COLOR);
  doc.text(String(label), x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_COLOR);

  // wrap each provided line to fit the column
  const flattened = [];
  for (const l of (lines || [])) {
    const segs = splitText(doc, String(l ?? ''), width);
    flattened.push(...(segs.length ? segs : ['—']));
  }
  if (!flattened.length) flattened.push('—');

  doc.text(flattened, x, y + 12);

  const usedH = 12 + (flattened.length - 1) * 12;
  return y + usedH + afterGap;
}

/**
 * Build a jsPDF doc for a receipt and return { doc, fileName }.
 */
function buildReceiptDoc(r) {
  const currency = r?.payment?.currency || 'USD';

  const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // 612 x 792
  doc.setFont('helvetica', 'normal');
  const margin = 56;
  const gutter = 18;
  const { w: pageW } = getPageSize(doc);
  const contentW = pageW - margin * 2;
  const colW = (contentW - gutter) / 2;

  // Header
  let y = margin - 10;
  doc.setFillColor(...HEADER_BG);
  doc.rect(margin - 12, y - 18, contentW + 24, 68, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(18);
  const restName = r?.restaurant?.name ?? r?.restaurant ?? '—';
  doc.text(`Receipt — ${restName}`, margin, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const restAddr = r?.restaurant?.address ? `${r.restaurant.address}` : '';
  if (restAddr) doc.text(splitText(doc, restAddr, contentW), margin, y + 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const orderNo = r?.order_number ?? r?.order_id ?? '—';
  doc.text(`Order # ${orderNo}`, margin + contentW, y + 12, { align: 'right' });

  y += 64;

  // ------------------ Order Info (clean layout) ------------------
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Order Info', margin, y);
  y += 10;
  divider(doc, { x: margin, y, width: contentW });
  y += 12;

  // Left column
  let leftY = y;

  // Order Date inline
  leftY = drawInlineField(doc, {
    x: margin, y: leftY, width: colW,
    label: 'Order Date',
    value: fmtDateTime(r?.scheduled_for)
  });

  // School & Team block
  const school = r?.placed_by?.school_name || '—';
	const genderDisplay = r?.gender ? capFirst(r.gender) : null;
  const teamLine = [
    r?.team,
    genderDisplay,
    r?.sport
  ].filter(Boolean).join(' ') || (r?.team || '—');

  leftY = drawLabelWithLines(doc, {
    x: margin, y: leftY, width: colW,
    label: 'School & Team',
    lines: [school, teamLine],
    afterGap: 12
  });

	leftY += 10;

	// Placed By: name then email (no "Email" label) — LEFT column
	if (r?.placed_by?.first_name || r?.placed_by?.last_name || r?.placed_by?.email) {
		const name = [r?.placed_by?.first_name, r?.placed_by?.last_name]
			.filter(Boolean)
			.join(' ')
			.trim() || '—';
		const lines = [name];
		if (r?.placed_by?.email) lines.push(r.placed_by.email);

		leftY = drawLabelWithLines(doc, {
			x: margin,
			y: leftY,
			width: colW,
			label: 'Placed By',
			lines,
			afterGap: 12
		});
	}

  // Right column
  let rightY = y;

  // Status inline
  rightY = drawInlineField(doc, {
    x: margin + colW + gutter, y: rightY, width: colW,
    label: 'Status',
    value: r?.status || '—'
  });

  // Order Type inline
  rightY = drawInlineField(doc, {
    x: margin + colW + gutter, y: rightY, width: colW,
    label: 'Order Type',
    value: r?.fulfillment_method || '—'
  });

  // Deliver To (if delivery)
  if (r?.fulfillment_method === 'delivery' && r?.delivery_address?.line1) {
    const a = r.delivery_address;
    const addr = [a.line1, a.line2, [a.city, a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    rightY = drawLabelWithLines(doc, {
      x: margin + colW + gutter, y: rightY, width: colW,
      label: 'Deliver To',
      lines: [addr],
      afterGap: 12
    });
  }


  // Tracking link (small)
  if (r?.links?.tracking) {
    doc.setTextColor(26, 115, 232);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Tracking', margin + colW + gutter, rightY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.textWithLink(
      r.links.tracking,
      margin + colW + gutter,
      rightY + 12,
      { url: r.links.tracking }
    );
    doc.setTextColor(...TEXT_COLOR);
    rightY += 26;
  }

  // continue below the taller column
  y = Math.max(leftY, rightY) + 8;

  // ------------------ Items table ------------------
  y = ensureSpace(doc, y, 120, margin);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Items', margin, y);
  y += 8;
  divider(doc, { x: margin, y, width: contentW });
  y += 10;

  const rows = (r?.items ?? []).map(it => {
    const opts = it?.options ?? [];
    const extras = Number.isFinite(it?.options_total_cents)
      ? (it.options_total_cents ?? 0)
      : extrasFromOptions(opts);
    const unit = it?.unit_price_cents ?? 0;
    const base = Number.isFinite(it?.base_price_cents)
      ? (it.base_price_cents ?? (unit - extras))
      : (unit - extras);

    const customizations =
      opts.length
        ? opts
            .map(o =>
              `${o.name}${o.price_cents ? ` (+${fmtCurrency(o.price_cents, currency)})` : ''}${
                o.quantity > 1 ? ` ×${o.quantity}` : ''
              }`
            )
            .join(', ')
        : '—';

    const breakdown =
      `${fmtCurrency(Math.max(base, 0), currency)}${extras ? ` + ${fmtCurrency(extras, currency)}` : ''}`;

    return [
      it?.name ?? '',
      customizations,
      breakdown,
      String(it?.quantity ?? 1),
      fmtCurrency(unit, currency),
      fmtCurrency(it?.line_total_cents ?? 0, currency)
    ];
  });

  const qtyW       = 44;
  const unitW      = 72;
  const amtW       = 84;
  const breakdownW = 120;

  const sumTableW = Math.min(360, contentW);
  const sumLeft   = margin + contentW - sumTableW;

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Customizations', 'Unit (base + extras)', 'Qty', 'Unit Price', 'Amount']],
    body: rows,
    theme: 'grid',
    tableWidth: contentW,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 10,
      cellPadding: 6,
      lineColor: BORDER_COLOR,
      textColor: TEXT_COLOR,
      overflow: 'linebreak'
    },
    headStyles: { fillColor: [242, 243, 245], textColor: [40, 40, 40], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      2: { cellWidth: breakdownW },
      3: { halign: 'right', cellWidth: qtyW },
      4: { halign: 'right', cellWidth: unitW },
      5: { halign: 'right', cellWidth: amtW }
    },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      const { w, h } = getPageSize(doc);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${page}`, w - margin, h - 18, { align: 'right' });
    }
  });

  y = (doc.lastAutoTable?.finalY || y) + 18;

  // ------------------ Payment details ------------------
  y = ensureSpace(doc, y, 80, margin);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Payment Details', margin, y);
  y += 8;
  divider(doc, { x: margin, y, width: contentW });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const payLines = [];
  if (r?.payment?.card_name || r?.payment?.last_four) {
    payLines.push(
      `Method: ${r.payment.card_name ?? '—'}${r.payment.last_four ? ` (•••• ${r.payment.last_four})` : ''}`
    );
  }
  if (r?.payment?.payment_status) {
    payLines.push(`Status: ${r.payment.payment_status}`);
  }
  if (!payLines.length) payLines.push('—');
  doc.text(payLines, margin, y);
  y += 18;

  // ------------------ Totals summary ------------------
  const fees = r?.fees || {};
  const totals = r?.totals || {};
  const pctBps = fees?.added_fee_percent_bps;
  const pctDisp = typeof pctBps === 'number' ? (pctBps / 100).toFixed(2) + '%' : null;
  const isVoided = String(r?.payment?.payment_status || '').toLowerCase() === 'voided';

  const summaryRows = [
    ['Subtotal', fmtCurrency(totals?.subtotal_cents ?? 0, currency)],
    ...(fees?.delivery_fee_cents ? [['Delivery fee', fmtCurrency(fees.delivery_fee_cents, currency)]] : []),
    ...(fees?.service_fee_cents ? [['Service fee', fmtCurrency(fees.service_fee_cents, currency)]] : []),
    ...(fees?.small_order_fee_cents ? [['Small order fee', fmtCurrency(fees.small_order_fee_cents, currency)]] : []),
    ...(fees?.sales_tax_cents ? [['Sales tax', fmtCurrency(fees.sales_tax_cents, currency)]] : []),
    ...(fees?.added_fee_flat_cents ? [['Added fee (flat)', fmtCurrency(fees.added_fee_flat_cents, currency)]] : []),
    ...(pctDisp ? [[`Added fee (${pctDisp})`, fmtCurrency(fees?.added_fee_percent_amount_cents ?? 0, currency)]] : []),
    ['Total (before tip)', fmtCurrency(totals?.total_without_tips_cents ?? 0, currency)],
    ...(totals?.tip_cents ? [['Tip', fmtCurrency(totals.tip_cents, currency)]] : []),
    ['Total paid', isVoided ? '—' : fmtCurrency(totals?.total_with_tip_cents ?? 0, currency)]
  ];

  const sumLabelW = Math.round(sumTableW * 0.58);
  const sumAmtW   = sumTableW - sumLabelW;

  autoTable(doc, {
    startY: y,
    head: [['Summary', 'Amount']],
    body: summaryRows,
    theme: 'plain',
    tableWidth: sumTableW,
    margin: { left: sumLeft, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 0, right: 0 }
    },
    headStyles: {
      fontSize: 9,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: sumLabelW },
      1: { cellWidth: sumAmtW, halign: 'right' }
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 1) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'body' && data.row?.raw?.[0] === 'Total paid') {
        if (!isVoided) {
          data.cell.styles.fontSize = 12;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [130,130,130];
        }
      }
    },
    didDrawCell: (data) => {
      if (!isVoided && data.section === 'body' && data.row?.raw?.[0] === 'Total paid' && data.column.index === 0) {
        const x = data.cell.x;
        const yLine = data.cell.y;
        doc.setDrawColor(...BORDER_COLOR);
        doc.setLineWidth(0.5);
        doc.line(x, yLine, x + sumTableW, yLine);
      }
    }
  });

  y = (doc.lastAutoTable?.finalY || y) + 16;

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Thank you for your order.', margin, y);
  y += 12;
  doc.setFontSize(8);
  doc.text('Generated by MealOps', margin, y);

  return { doc, fileName: makeFileName(r) };
}

// ---- single download -------------------------------------------------------
export async function downloadReceiptPdf(orderId) {
  const r = await fetchReceipt(orderId);
  const { doc, fileName } = buildReceiptDoc(r);
  doc.save(fileName);
}

// ---- bulk zip (reuse the same renderer) -----------------------------------
export async function downloadReceiptsZip(orderIds = []) {
  const zip = new JSZip();

  for (const id of orderIds) {
    const r = await fetchReceipt(id);
    const { doc, fileName } = buildReceiptDoc(r);
    const pdfArrayBuffer = doc.output('arraybuffer');
    zip.file(fileName, pdfArrayBuffer);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'receipts.zip';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}