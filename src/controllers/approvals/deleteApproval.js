import ModuleApproval from '../../models/ModuleApproval.js';
import AppError from '../../utils/AppError.js';

const deleteApproval = async (req, res, next) => {
  try {
    const { approvalId } = req.params;

    // Find and delete the approval
    const approval = await ModuleApproval.findByIdAndDelete(approvalId);

    if (!approval) {
      throw new AppError('Approval request not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'Approval request deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default deleteApproval;
