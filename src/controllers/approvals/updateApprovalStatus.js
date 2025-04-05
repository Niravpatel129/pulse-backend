import ModuleApproval from '../../models/ModuleApproval.js';
import AppError from '../../utils/AppError.js';

const updateApprovalStatus = async (req, res, next) => {
  try {
    const { approvalId } = req.params;
    const { status, comment, guestInfo } = req.body;

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

    // Add timeline entry for the approval/rejection
    approval.timeline.push({
      action: status,
      description: status === 'approved' ? 'Approved the request' : 'Rejected the request',
      performedBy: req.user?.userId,
      createdAt: new Date(),
    });

    // If there's a comment, add it as a separate timeline entry
    if (comment) {
      const timelineEntry = {
        action: 'commented',
        description: comment,
        createdAt: new Date(),
      };

      // If user is authenticated, use their ID
      if (req.user?.userId) {
        timelineEntry.performedBy = req.user.userId;
      }
      // If guest info is provided, use that
      else if (guestInfo) {
        timelineEntry.guestInfo = {
          name: guestInfo.name,
          email: guestInfo.email,
        };
      }

      approval.timeline.push(timelineEntry);
    }

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
