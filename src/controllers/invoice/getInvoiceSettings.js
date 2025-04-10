import Workspace from '../../models/Workspace.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoiceSettings = catchAsync(async (req, res, next) => {
  const workspaceId = req.workspace._id;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return next(new AppError('Workspace not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      invoiceSettings: workspace.invoiceSettings || {},
    },
  });
});
