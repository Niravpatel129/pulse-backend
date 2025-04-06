import ModuleApproval from '../../models/ModuleApproval.js';
import ProjectModule from '../../models/ProjectModule.js';
import User from '../../models/User.js';
import emailService from '../../services/emailService.js';
import AppError from '../../utils/AppError.js';

const requestApproval = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { approvers, message, sendReminder, allowComments, moduleDetails } = req.body;
    const workspace = req.workspace;

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
        // Check if user exists by email
        let user = await User.findOne({ email: approver.email });

        // If user doesn't exist, create a new inactive user
        if (!user) {
          user = await User.create({
            name: approver.name,
            email: approver.email,
            password: Math.random().toString(36).slice(-8), // Generate random password
            isActivated: false,
            role: 'user',
          });
        }

        const approvalRecord = await ModuleApproval.create({
          moduleId: module._id,
          requestedBy: req.user.userId,
          approverId: user._id,
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

        // find user name
        const senderUser = await User.findById(req.user.userId);

        // Send approval email to the approver
        await emailService.sendApprovalEmail({
          moduleName: module.name,
          message: message,
          senderName: senderUser?.name?.charAt(0).toUpperCase() + senderUser?.name?.slice(1) || '',
          recipientEmail: approver.email,
          subject: `Approval Request: ${module.name} from ${
            senderUser?.name?.charAt(0).toUpperCase() + senderUser?.name?.slice(1) || ''
          }`,
          link: `${workspace.name}.${process.env.FRONTEND_URL}/approvals/${approvalRecord._id}?user=${user._id}`,
        });

        return approvalRecord;
      }),
    );

    res.status(200).json({
      status: 'success',
      message: 'Approval requests created and emails sent successfully',
      data: approvalRequests,
    });
  } catch (error) {
    next(error);
  }
};

export default requestApproval;
