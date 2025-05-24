import PDFDocument from 'pdfkit';
import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const downloadInvoice = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the invoice
    const invoice = await Invoice2.findOne({
      _id: id,
      workspace: req.workspace._id,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
    );

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Add content to the PDF
    generateInvoicePDF(doc, invoice);

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    next(error);
  }
});

function generateInvoicePDF(doc, invoice) {
  // Add business logo if available
  if (invoice.logo) {
    try {
      doc.image(invoice.logo, 50, 45, { width: 100 });
      doc.moveDown();
    } catch (error) {
      // Continue if logo can't be loaded
      console.error('Could not load logo:', error);
    }
  }

  // Add business information
  doc.fontSize(20).text(invoice.from?.name || 'Your Business', { align: 'left' });
  doc.fontSize(10).text(invoice.from?.address || '', { align: 'left' });
  if (invoice.from?.taxId) {
    doc.text(`Tax ID: ${invoice.from.taxId}`, { align: 'left' });
  }

  // Add invoice information
  doc
    .fontSize(10)
    .text(`Invoice: ${invoice.invoiceNumber}`, { align: 'right' })
    .text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' })
    .text(`Created: ${new Date(invoice.createdAt).toLocaleDateString()}`, { align: 'right' });

  doc.moveDown();

  // Add client information
  doc.fontSize(14).text('Bill To:', { align: 'left' }).moveDown(0.5);
  doc
    .fontSize(10)
    .text(invoice.to?.name || '')
    .text(invoice.to?.address || '')
    .text(invoice.to?.email || '');

  if (invoice.to?.taxId) {
    doc.text(`Tax ID: ${invoice.to.taxId}`);
  }

  doc.moveDown();

  // Add items table
  doc.fontSize(14).text('Items', { align: 'left' }).moveDown(0.5);

  // Table headers
  const tableTop = doc.y;
  let tableLeft = 50;
  const pageWidth = 512; // 612 - 2 * margin(50)
  const quantityX = tableLeft + 350;
  const priceX = tableLeft + 420;
  const lineEndX = priceX + 90; // Extend line to cover full width including price

  // Table headers
  doc
    .fontSize(10)
    .text('Item', tableLeft, tableTop)
    .text('Quantity', quantityX - 30, tableTop)
    .text('Price', priceX - 30, tableTop);

  // Header line
  doc
    .moveTo(tableLeft, tableTop + 15)
    .lineTo(lineEndX, tableTop + 15)
    .stroke();

  let itemY = tableTop + 20;

  // List items
  invoice.items.forEach((item) => {
    // Item name
    doc.fontSize(10).text(item.name, tableLeft, itemY, { width: 280 });

    // Quantity and Price (right-aligned)
    doc
      .text(item.quantity.toString(), quantityX, itemY, { width: 30, align: 'right' })
      .text(`${item.price.toFixed(2)} ${invoice.settings.currency}`, priceX, itemY, {
        width: 70,
        align: 'right',
      });

    // Description if exists
    if (item.description) {
      itemY += 15;
      doc.fontSize(8).text(item.description, tableLeft, itemY, { width: 280 });
    }

    itemY += 20;
  });

  // Bottom line after items
  doc.moveTo(tableLeft, itemY).lineTo(lineEndX, itemY).stroke();

  itemY += 10;

  // Calculate totals
  const subtotal = invoice.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = invoice.settings.discount.enabled
    ? (subtotal * invoice.settings.discount.amount) / 100
    : 0;
  const tax = invoice.settings.salesTax.enabled
    ? (subtotal * invoice.settings.salesTax.rate) / 100
    : 0;
  const total = subtotal - discount + tax;

  // Align totals to the right
  const totalsX = priceX - 60;

  doc
    .fontSize(10)
    .text('Subtotal:', totalsX, itemY, { width: 60, align: 'right' })
    .text(`${subtotal.toFixed(2)} ${invoice.settings.currency}`, priceX, itemY, {
      width: 70,
      align: 'right',
    });

  itemY += 20;

  if (discount > 0) {
    doc
      .fontSize(10)
      .text('Discount:', totalsX, itemY, { width: 60, align: 'right' })
      .text(`-${discount.toFixed(2)} ${invoice.settings.currency}`, priceX, itemY, {
        width: 70,
        align: 'right',
      });
    itemY += 20;
  }

  if (tax > 0) {
    doc
      .fontSize(10)
      .text('Tax:', totalsX, itemY, { width: 60, align: 'right' })
      .text(`${tax.toFixed(2)} ${invoice.settings.currency}`, priceX, itemY, {
        width: 70,
        align: 'right',
      });
    itemY += 20;
  }

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Total:', totalsX, itemY, { width: 60, align: 'right' })
    .text(`${total.toFixed(2)} ${invoice.settings.currency}`, priceX, itemY, {
      width: 70,
      align: 'right',
    });

  // Add notes if any
  if (invoice.notes) {
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Notes');
    doc.fontSize(10).font('Helvetica').text(invoice.notes);
  }
}
