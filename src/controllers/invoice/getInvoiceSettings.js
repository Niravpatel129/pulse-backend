import Workspace from '../../models/Workspace.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoiceSettings = catchAsync(async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    if (!workspaceId) {
      return next(new AppError('Workspace ID is required', 400));
    }

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
  } catch (error) {
    next(error);
  }
});
