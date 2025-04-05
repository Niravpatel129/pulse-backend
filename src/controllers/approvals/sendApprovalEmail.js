import ModuleApproval from '../../models/ModuleApproval.js';
import ModuleEmail from '../../models/ModuleEmail.js';
import emailService from '../../services/emailService.js';
import AppError from '../../utils/AppError.js';

const sendApprovalEmail = async (req, res, next) => {
  try {
    const { approvalId } = req.params;

    // Find the approval record
    const approval = await ModuleApproval.findById(approvalId).populate('moduleId');
    if (!approval) {
      throw new AppError('Approval request not found', 404);
    }

    // Create email record
    const emailRecord = await ModuleEmail.create({
      moduleId: approval.moduleId._id,
      subject: `Approval Request for Module: ${approval.moduleId.name}`,
      message: approval.message,
      sentBy: approval.requestedBy,
      recipientEmail: approval.approverEmail,
      status: 'awaiting_approval',
      requestApproval: true,
      allowComments: approval.allowComments,
      moduleDetails: approval.moduleDetails,
    });

    // Send approval request email
    await emailService.sendApprovalEmail({
      moduleName: approval.moduleId.name,
      message: approval.message,
      senderName: req.user.name,
      recipientEmail: approval.approverEmail,
      subject: `Approval Request for Module: ${approval.moduleId.name}`,
      requestApproval: true,
      allowComments: approval.allowComments,
      moduleDetails: approval.moduleDetails,
    });

    res.status(200).json({
      status: 'success',
      message: 'Approval email sent successfully',
      data: emailRecord,
    });
  } catch (error) {
    next(error);
  }
};

export default sendApprovalEmail;
