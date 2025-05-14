import PDFDocument from 'pdfkit';
import Workspace from '../../models/Workspace.js';
import Payment from '../../models/paymentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const downloadPayment = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the payment with populated invoice data
    const payment = await Payment.findById(id).populate({
      path: 'invoice',
      populate: [
        { path: 'client', populate: { path: 'user', select: 'name email' } },
        { path: 'items' },
      ],
    });

    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    // Get invoice settings from workspace
    const workspace = await Workspace.findById(payment.invoice.workspace);
    const invoiceSettings = workspace?.invoiceSettings || {};

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Invoice-${payment.invoice.invoiceNumber}.pdf"`,
    );

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Add content to the PDF
    generateInvoicePDF(doc, payment, invoiceSettings);

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    next(error);
  }
});

function generateInvoicePDF(doc, payment, invoiceSettings) {
  const { invoice, amount, date, method, paymentNumber, remainingBalance, status } = payment;

  // Add business logo if available
  if (invoiceSettings?.logo) {
    try {
      doc.image(invoiceSettings.logo, 50, 45, { width: 100 });
      doc.moveDown();
    } catch (error) {
      // Continue if logo can't be loaded
      console.error('Could not load logo:', error);
    }
  }

  // Add business information
  doc.fontSize(20).text(invoiceSettings?.businessName || 'Your Business', { align: 'left' });
  doc.fontSize(10).text(invoiceSettings?.businessAddress || '', { align: 'left' });
  if (invoiceSettings?.showTaxId && invoiceSettings?.taxId) {
    doc.text(`Tax ID: ${invoiceSettings.taxId}`, { align: 'left' });
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
    .text(invoice.client.user.name)
    .text(invoice.client.address.street)
    .text(`${invoice.client.address.city}, ${invoice.client.address.state}`)
    .text(invoice.client.address.country);

  if (invoice.client.taxId) {
    doc.text(`Tax ID: ${invoice.client.taxId}`);
  }

  if (invoice.client.user.email) {
    doc.text(invoice.client.user.email);
  }

  if (invoice.client.phone) {
    doc.text(invoice.client.phone);
  }

  doc.moveDown();

  // Add payment information
  doc.fontSize(14).text('Payment Details:', { align: 'left' }).moveDown(0.5);
  doc
    .fontSize(10)
    .text(`Payment #${paymentNumber}`)
    .text(`Amount: ${amount.toFixed(2)} ${invoice.currency}`)
    .text(`Method: ${method.charAt(0).toUpperCase() + method.slice(1)}`)
    .text(`Date: ${new Date(date).toLocaleDateString()}`)
    .text(`Remaining Balance: ${remainingBalance.toFixed(2)} ${invoice.currency}`)
    .text(`Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`);

  doc.moveDown();

  // Add items table
  doc.fontSize(14).text('Items', { align: 'left' }).moveDown(0.5);

  // Table headers
  const tableTop = doc.y;
  let tableLeft = 50;

  doc
    .fontSize(10)
    .text('Item', tableLeft, tableTop)
    .text('Quantity', tableLeft + 250, tableTop, { width: 50, align: 'right' })
    .text('Price', tableLeft + 300, tableTop, { width: 90, align: 'right' })
    .text('Total', tableLeft + 390, tableTop, { width: 100, align: 'right' });

  doc
    .moveTo(tableLeft, tableTop + 15)
    .lineTo(tableLeft + 490, tableTop + 15)
    .stroke();

  let itemY = tableTop + 20;

  // List items
  invoice.items.forEach((item) => {
    const itemTotal =
      item.price * item.quantity - item.discount + item.price * item.quantity * (item.tax / 100);

    doc
      .fontSize(10)
      .text(item.name, tableLeft, itemY)
      .text(item.quantity.toString(), tableLeft + 250, itemY, { width: 50, align: 'right' })
      .text(`${item.price.toFixed(2)} ${invoice.currency}`, tableLeft + 300, itemY, {
        width: 90,
        align: 'right',
      })
      .text(`${itemTotal.toFixed(2)} ${invoice.currency}`, tableLeft + 390, itemY, {
        width: 100,
        align: 'right',
      });

    if (item.description) {
      itemY += 15;
      doc.fontSize(8).text(item.description, tableLeft, itemY, { width: 240 });
    }

    itemY += 20;
  });

  // Add totals
  doc
    .moveTo(tableLeft + 300, itemY)
    .lineTo(tableLeft + 490, itemY)
    .stroke();

  itemY += 10;

  // Calculate total tax
  const totalTax = invoice.items.reduce((sum, item) => {
    return sum + item.price * item.quantity * (item.tax / 100);
  }, 0);

  doc
    .fontSize(10)
    .text('Subtotal:', tableLeft + 300, itemY, { width: 120, align: 'right' })
    .text(`${invoice.subtotal.toFixed(2)} ${invoice.currency}`, tableLeft + 420, itemY, {
      width: 70,
      align: 'right',
    });

  itemY += 20;

  doc
    .fontSize(10)
    .text('Tax:', tableLeft + 300, itemY, { width: 120, align: 'right' })
    .text(`${totalTax.toFixed(2)} ${invoice.currency}`, tableLeft + 420, itemY, {
      width: 70,
      align: 'right',
    });

  itemY += 20;

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Total:', tableLeft + 300, itemY, { width: 120, align: 'right' })
    .text(`${invoice.total.toFixed(2)} ${invoice.currency}`, tableLeft + 420, itemY, {
      width: 70,
      align: 'right',
    });

  // Add notes if any
  if (invoice.notes || invoiceSettings?.businessNotes) {
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Notes');
    doc.fontSize(10).font('Helvetica');

    if (invoice.notes) {
      doc.text(invoice.notes);
    }

    if (invoice.notes && invoiceSettings?.businessNotes) {
      doc.moveDown(0.5);
    }

    if (invoiceSettings?.businessNotes) {
      doc.text(invoiceSettings.businessNotes);
    }
  }
}
