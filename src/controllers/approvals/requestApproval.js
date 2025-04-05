import ModuleApproval from '../../models/ModuleApproval.js';
import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const requestApproval = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { approvers, message, sendReminder, allowComments, moduleDetails } = req.body;

    if (!approvers || approvers.length === 0) {
      throw new AppError('Please select at least one approver', 400);
    }

    // Find the module
    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Create approval request records for each approver
    const approvalRequests = await Promise.all(
      approvers.map(async (approver) => {
        const approvalRecord = await ModuleApproval.create({
          moduleId: module._id,
          requestedBy: req.user.userId,
          approverId: approver.id,
          approverEmail: approver.email,
          message,
          status: 'pending',
          allowComments,
          moduleDetails,
          sendReminder,
          timeline: [
            {
              action: 'requested',
              description: message,
              performedBy: req.user.userId,
              createdAt: new Date(),
            },
          ],
        });

        return approvalRecord;
      }),
    );

    res.status(200).json({
      status: 'success',
      message: 'Approval requests created successfully',
      data: approvalRequests,
    });
  } catch (error) {
    next(error);
  }
};

export default requestApproval;
