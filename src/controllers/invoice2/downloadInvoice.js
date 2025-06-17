import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

async function fetchLogoBuffer(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    return null;
  }
}

async function generateQRCode(text) {
  try {
    return await QRCode.toDataURL(text);
  } catch {
    return null;
  }
}

// ---- Main Download Invoice Handler ----
export const downloadInvoice = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. ───── Fetch invoice ─────────────────────────────────────────────
    const invoice = await Invoice2.findOne({
      _id: id,
      workspace: req.workspace._id,
    });
    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    // 2. ───── Optional assets ───────────────────────────────────────────
    const logoBuffer = invoice.logo ? await fetchLogoBuffer(invoice.logo) : null;
    const qrCodeData = invoice.paymentLink ? await generateQRCode(invoice.paymentLink) : null;

    // 3. ───── PDF setup ─────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
    );
    doc.pipe(res);

    // --- Header background (very light) ---
    doc.rect(0, 0, doc.page.width, 120).fillOpacity(0.03).fill('#121212').fillOpacity(1);

    // --- Logo (top‑right) ---
    if (logoBuffer) {
      doc.image(logoBuffer, doc.page.width - 40 - 100, 30, { width: 100 });
    }

    // --- Invoice title + meta (top‑left) ---
    doc
      .fillColor('#000')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(invoice.title || 'Invoice', 40, 40);

    doc
      .fontSize(11)
      .font('Helvetica')
      .text(`Invoice No: ${invoice.invoiceNumber}`, 40, 70)
      .text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 40, 85)
      .text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 40, 100);

    doc.moveDown(2);

    // 4. ───── From / To ────────────────────────────────────────────────
    const fromToY = doc.y;
    doc.font('Helvetica-Bold').text('From:', 40, fromToY);
    doc.font('Helvetica').text(invoice.from, 40, fromToY + 15);

    doc.font('Helvetica-Bold').text('To:', 300, fromToY);
    doc.font('Helvetica').text(invoice.to, 300, fromToY + 15);
    doc.moveDown(5);

    // 5. ───── Items table header ───────────────────────────────────────
    const tableTopY = doc.y;
    doc.rect(40, tableTopY - 5, 515, 20).fill('#fff');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(11);
    doc.text('Description', 45, tableTopY);
    doc.text('Qty', 230, tableTopY);
    doc.text('Price', 310, tableTopY);
    doc.text('Total', 455, tableTopY, { align: 'right', width: 100 });

    // 6. ───── Items table rows ─────────────────────────────────────────
    doc.font('Helvetica').fontSize(11).fillColor('#000');
    let rowY = tableTopY + 25;

    invoice.items.forEach((item) => {
      doc.text(item.description, 45, rowY);
      doc.text(item.quantity.toString(), 230, rowY);
      doc.text(`${invoice.settings.currency}${item.price.toLocaleString()}`, 310, rowY);
      doc.text(
        `${invoice.settings.currency}${(item.quantity * item.price).toLocaleString()}`,
        455,
        rowY,
        { align: 'right', width: 100 },
      );
      rowY += 20;
    });

    // Leave a gap after items
    rowY += 10;

    // 7. ───── Totals box (fixed width, right‑aligned) ──────────────────
    const boxPadding = 15;
    const boxWidth = 200; // width of the summary box
    const boxX = doc.page.width - 40 - boxWidth; // right margin alignment
    const labelX = boxX + boxPadding;
    const valueWidth = boxWidth - boxPadding * 2;

    // Position totals box 80 points from bottom of page
    const totalsBoxHeight = 110;
    let summaryY = doc.page.height - totalsBoxHeight - 80;

    // Draw box background
    doc
      .rect(boxX, summaryY - 10, boxWidth, totalsBoxHeight)
      .fillOpacity(0.07)
      .fill('#FFF')
      .fillOpacity(1);

    // Write each line
    const writePair = (label, value) => {
      doc.font('Helvetica').fontSize(11).fillColor('#121212').text(label, labelX, summaryY);
      doc.text(value, labelX, summaryY, { width: valueWidth, align: 'right' });
      summaryY += 20;
    };

    writePair(
      'Subtotal:',
      `${invoice.settings.currency}${invoice.totals.subtotal.toLocaleString()}`,
    );

    if (invoice.settings.vat?.enabled) {
      writePair(
        `VAT (${invoice.settings.vat.rate}%)`,
        `${invoice.settings.currency}${invoice.totals.vatAmount.toLocaleString()}`,
      );
    }

    if (invoice.settings.salesTax?.enabled) {
      writePair(
        `Tax (${invoice.settings.salesTax.rate}%)`,
        `${invoice.settings.currency}${invoice.totals.taxAmount.toLocaleString()}`,
      );
    }

    if (invoice.settings.discount?.enabled) {
      writePair(
        'Discount:',
        `-${invoice.settings.currency}${invoice.totals.discount.toLocaleString()}`,
      );
    }

    // Separator line
    doc
      .moveTo(labelX, summaryY)
      .lineTo(boxX + boxWidth - boxPadding, summaryY)
      .stroke();
    summaryY += 10;

    // Total (bold, larger)
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('Total:', labelX, summaryY);
    doc.font('Helvetica-Bold').fontSize(18);
    doc.text(
      `${invoice.settings.currency}${invoice.totals.total.toLocaleString()}`,
      labelX,
      summaryY,
      { width: valueWidth, align: 'right' },
    );

    // 9. ───── Notes (optional) ─────────────────────────────────────────
    if (invoice.notes) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .fillColor('gray')
        .text(invoice.notes, 40, doc.page.height - 60, { width: doc.page.width - 80 });
    }

    // 10. ───── Finalize ────────────────────────────────────────────────
    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    next(new AppError('Failed to generate PDF', 500));
  }
});
