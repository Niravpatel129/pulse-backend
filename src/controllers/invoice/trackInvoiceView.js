import Invoice from '../../models/invoiceModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const trackInvoiceView = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { source } = req.body;

  // Get the invoice
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    return res.status(404).json({
      status: 'fail',
      message: 'Invoice not found',
    });
  }

  // Don't track views from the same workspace (likely internal testing)
  const isInternalView = req.user && String(req.user.workspaceId) === String(invoice.workspace);

  if (!isInternalView) {
    // Add view to timeline
    const viewEntry = {
      type: 'viewed',
      timestamp: new Date(),
      description:
        source === 'payment_page'
          ? 'Invoice payment page was viewed by client'
          : 'Invoice was viewed by client',
      metadata: {
        source: source || 'unknown',
        clientIp: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    };

    invoice.timeline.push(viewEntry);
    await invoice.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'View tracked successfully',
  });
});
