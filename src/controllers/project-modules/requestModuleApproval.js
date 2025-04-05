import ModuleEmail from '../../models/ModuleEmail.js';
import ProjectModule from '../../models/ProjectModule.js';
import emailService from '../../services/emailService.js';
import AppError from '../../utils/AppError.js';

const requestModuleApproval = async (req, res, next) => {
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
        const emailRecord = await ModuleEmail.create({
          moduleId: module._id,
          subject: `Approval Request for Module: ${module.name}`,
          message,
          sentBy: req.user.userId,
          recipientEmail: approver.email,
          status: 'awaiting_approval',
          requestApproval: true,
          allowComments,
          moduleDetails,
        });

        // Send approval request email
        await emailService.sendApprovalEmail({
          moduleName: module.name,
          message,
          senderName: req.user.name,
          recipientEmail: approver.email,
          subject: `Approval Request for Module: ${module.name}`,
          requestApproval: true,
          allowComments,
          moduleDetails,
        });

        return emailRecord;
      }),
    );

    res.status(200).json({
      status: 'success',
      message: 'Approval requests sent successfully',
      data: approvalRequests,
    });
  } catch (error) {
    next(error);
  }
};

export default requestModuleApproval;
