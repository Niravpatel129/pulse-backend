import Module from '../../models/Module.js';
import ModuleEmail from '../../models/ModuleEmail.js';
import Workspace from '../../models/Workspace.js';
import emailService from '../../services/emailService.js';
import { handleError } from '../../utils/errorHandler.js';

export const sendApprovalEmail = async (req, res) => {
  try {
    const { moduleId, subject, message, requestApproval } = req.body;
    const workspaceId = req.workspace._id;
    // Fallback email for workspaces with no client members
    const FALLBACK_CLIENT_EMAIL = 'niravpatelp129@gmail.com';

    // Validate required fields
    if (!moduleId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Module ID, subject, and message are required',
      });
    }

    // Check if module exists
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found',
      });
    }

    // Check if user has permission to send email for this module
    if (
      !module.assignedTo.some((id) => id.toString() === req.user.userId.toString()) &&
      module.createdBy.toString() !== req.user.userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send emails for this module',
      });
    }

    // Get workspace with populated members to retrieve client email and team members
    const workspace = await Workspace.findById(workspaceId).populate({
      path: 'members',
      populate: {
        path: 'user',
        select: 'email name',
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    // Find client members in the workspace
    const clientMembers = workspace.members.filter(
      (member) => member.role === 'client' && member.user && member.user.email,
    );

    let recipientsList = clientMembers;

    // If no client members found, use fallback email
    if (clientMembers.length === 0) {
      console.log(
        `No client members found in workspace. Using fallback email: ${FALLBACK_CLIENT_EMAIL}`,
      );
      recipientsList = [
        {
          user: {
            email: FALLBACK_CLIENT_EMAIL,
            name: 'Fallback Client',
          },
        },
      ];
    }

    // Send email to all client members (or fallback)
    for (const clientMember of recipientsList) {
      await emailService.sendApprovalEmail({
        moduleName: module.name,
        message,
        senderName: req.user.name,
        recipientEmail: clientMember.user.email,
        subject,
        requestApproval,
      });
    }

    // Send email to all team members (non-client members)
    const teamMembers = workspace.members.filter(
      (member) => member.role !== 'client' && member.user && member.user.email,
    );
    for (const member of teamMembers) {
      await emailService.sendApprovalEmail({
        moduleName: module.name,
        message,
        senderName: req.user.name,
        recipientEmail: member.user.email,
        subject,
        requestApproval,
      });
    }

    // Create new email records for each client (or fallback)
    const emailRecords = [];
    for (const clientMember of recipientsList) {
      const emailRecord = await ModuleEmail.create({
        moduleId: module._id,
        subject,
        message,
        sentBy: req.user.userId,
        recipientEmail: clientMember.user.email,
        status: requestApproval ? 'awaiting_approval' : 'not_seen',
        requestApproval,
      });
      emailRecords.push(emailRecord);
    }

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully to clients and team members',
      emailRecords,
    });
  } catch (error) {
    console.error('Error sending approval email:', error);
    return handleError(res, error, 'Failed to send approval email');
  }
};
