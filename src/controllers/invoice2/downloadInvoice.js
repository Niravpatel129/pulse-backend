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

    // Create a PDF document with better margins
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: invoice.from,
      },
    });

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
  // Define colors
  const primaryColor = '#2563eb'; // Blue
  const secondaryColor = '#64748b'; // Gray
  const borderColor = '#e2e8f0'; // Light gray

  // Add header with background
  doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);

  // Add business logo if available
  if (invoice.logo) {
    try {
      doc.image(invoice.logo, 50, 35, { width: 80 });
    } catch (error) {
      console.error('Could not load logo:', error);
    }
  }

  // Add invoice title
  doc
    .fontSize(24)
    .fillColor('white')
    .text('INVOICE', doc.page.width - 200, 40, { align: 'right' })
    .fontSize(14)
    .text(invoice.invoiceNumber, doc.page.width - 200, 65, { align: 'right' });

  // Reset position for content
  doc.y = 140;

  // Add business information (from field is a textarea)
  doc
    .fontSize(16)
    .fillColor(primaryColor)
    .text('From:', { align: 'left' })
    .fontSize(10)
    .fillColor(secondaryColor)
    .text(invoice.from, { align: 'left' });

  // Add invoice dates
  doc
    .fontSize(10)
    .fillColor(secondaryColor)
    .text('Issue Date:', 400, 140, { align: 'right' })
    .text(new Date(invoice.issueDate).toLocaleDateString(), 400, 155, { align: 'right' })
    .text('Due Date:', 400, 170, { align: 'right' })
    .text(new Date(invoice.dueDate).toLocaleDateString(), 400, 185, { align: 'right' });

  doc.moveDown(2);

  // Add customer information section
  doc
    .fontSize(14)
    .fillColor(primaryColor)
    .text('Bill To:', { align: 'left' })
    .fontSize(10)
    .fillColor(secondaryColor);

  // Create a box for customer information
  const customerBox = {
    x: 50,
    y: doc.y,
    width: 250,
    height: 100,
  };

  doc.rect(customerBox.x, customerBox.y, customerBox.width, customerBox.height).stroke(borderColor);

  // Add customer details
  doc.text(invoice.customer.name, customerBox.x + 10, customerBox.y + 10);

  if (invoice.customer.email) {
    doc.text(invoice.customer.email, customerBox.x + 10, customerBox.y + 25);
  }

  // Add to field (textarea)
  doc.text(invoice.to, customerBox.x + 10, customerBox.y + 40);

  doc.y = customerBox.y + customerBox.height + 20;

  // Add items table
  doc.fontSize(14).fillColor(primaryColor).text('Items', { align: 'left' }).moveDown(0.5);

  // Table headers
  const tableTop = doc.y;
  const tableLeft = 50;
  const tableWidth = doc.page.width - 100;
  const columnWidth = tableWidth / 4;
  const quantityX = tableLeft + columnWidth * 2;
  const priceX = tableLeft + columnWidth * 3;

  // Table header background
  doc.rect(tableLeft, tableTop, tableWidth, 30).fill(borderColor);

  // Table headers
  doc
    .fontSize(10)
    .fillColor(primaryColor)
    .text('Description', tableLeft + 10, tableTop + 10)
    .text('Quantity', quantityX + 10, tableTop + 10)
    .text('Price', priceX + 10, tableTop + 10);

  let itemY = tableTop + 30;

  // List items
  invoice.items.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 0) {
      doc.rect(tableLeft, itemY, tableWidth, 40).fill('#f8fafc');
    }

    // Item description
    doc
      .fontSize(10)
      .fillColor(secondaryColor)
      .text(item.description, tableLeft + 10, itemY + 10, { width: columnWidth - 20 });

    // Quantity and Price
    doc
      .text(item.quantity.toString(), quantityX + 10, itemY + 10, {
        width: columnWidth - 20,
        align: 'right',
      })
      .text(
        `${item.price.toFixed(invoice.settings.decimals)} ${invoice.settings.currency}`,
        priceX + 10,
        itemY + 10,
        { width: columnWidth - 20, align: 'right' },
      );

    itemY += 40;
  });

  // Totals section
  const totalsY = itemY + 20;
  const totalsX = priceX - columnWidth;

  // Totals box
  doc.rect(totalsX, totalsY, columnWidth * 2, 120).stroke(borderColor);

  // Subtotal
  doc
    .fontSize(10)
    .fillColor(secondaryColor)
    .text('Subtotal:', totalsX + 10, totalsY + 20)
    .text(
      `${invoice.totals.subtotal.toFixed(invoice.settings.decimals)} ${invoice.settings.currency}`,
      totalsX + columnWidth - 10,
      totalsY + 20,
      { align: 'right' },
    );

  // Tax if enabled
  if (invoice.settings.salesTax.enabled && invoice.totals.taxAmount > 0) {
    doc
      .text('Tax:', totalsX + 10, totalsY + 40)
      .text(
        `${invoice.totals.taxAmount.toFixed(invoice.settings.decimals)} ${
          invoice.settings.currency
        }`,
        totalsX + columnWidth - 10,
        totalsY + 40,
        { align: 'right' },
      );
  }

  // VAT if enabled
  if (invoice.settings.vat.enabled && invoice.totals.vatAmount > 0) {
    doc
      .text('VAT:', totalsX + 10, totalsY + 60)
      .text(
        `${invoice.totals.vatAmount.toFixed(invoice.settings.decimals)} ${
          invoice.settings.currency
        }`,
        totalsX + columnWidth - 10,
        totalsY + 60,
        { align: 'right' },
      );
  }

  // Discount if enabled
  if (invoice.settings.discount.enabled && invoice.totals.discount > 0) {
    doc
      .text('Discount:', totalsX + 10, totalsY + 80)
      .text(
        `-${invoice.totals.discount.toFixed(invoice.settings.decimals)} ${
          invoice.settings.currency
        }`,
        totalsX + columnWidth - 10,
        totalsY + 80,
        { align: 'right' },
      );
  }

  // Total
  doc
    .fontSize(12)
    .fillColor(primaryColor)
    .text('Total:', totalsX + 10, totalsY + 100)
    .text(
      `${invoice.totals.total.toFixed(invoice.settings.decimals)} ${invoice.settings.currency}`,
      totalsX + columnWidth - 10,
      totalsY + 100,
      { align: 'right' },
    );

  // Add notes if any
  if (invoice.notes) {
    doc
      .moveDown(2)
      .fontSize(12)
      .fillColor(primaryColor)
      .text('Notes', { align: 'left' })
      .fontSize(10)
      .fillColor(secondaryColor)
      .text(invoice.notes, { align: 'left' });
  }

  // Add footer
  const footerY = doc.page.height - 50;
  doc
    .fontSize(8)
    .fillColor(secondaryColor)
    .text(`Generated on ${new Date().toLocaleDateString()} | ${invoice.from}`, 50, footerY, {
      align: 'center',
      width: doc.page.width - 100,
    });
}
