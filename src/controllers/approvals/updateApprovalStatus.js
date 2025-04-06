import ModuleApproval from '../../models/ModuleApproval.js';
import AppError from '../../utils/AppError.js';

const updateApprovalStatus = async (req, res, next) => {
  try {
    const { approvalId } = req.params;
    const { status, comment, userId } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Invalid status. Must be either "approved" or "rejected"', 400);
    }

    // Find and update the approval
    const approval = await ModuleApproval.findById(approvalId);
    if (!approval) {
      throw new AppError('Approval request not found', 404);
    }

    // Update approval status
    approval.status = status;
    approval.approvedAt = new Date();

    // Create timeline entry for the approval/rejection
    const timelineEntry = {
      action: status,
      description: status === 'approved' ? 'Approved the request' : 'Rejected the request',
      createdAt: new Date(),
      performedBy: userId,
    };

    // If there's a comment, add it to the same timeline entry
    if (comment) {
      timelineEntry.description += `: ${comment}`;
    }

    approval.timeline.push(timelineEntry);

    await approval.save();

    res.status(200).json({
      status: 'success',
      message: 'Approval status updated successfully',
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

export default updateApprovalStatus;
