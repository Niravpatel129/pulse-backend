/**
 * Centralized email templates for the application
 * All email templates should be defined here for consistency
 */

/**
 * Generate a workspace invitation email for new users
 * @param {Object} params - Parameters for the email template
 * @param {string} params.workspaceName - Name of the workspace
 * @param {string} params.role - Role assigned to the user
 * @param {string} params.inviteUrl - URL for accepting the invitation
 * @returns {Object} - Email subject and HTML content
 */
export const newUserWorkspaceInvitation = ({ workspaceName, role, inviteUrl }) => {
  return {
    subject: `Invitation to join ${workspaceName}`,
    html: `
      <p>You have been invited to join the workspace "${workspaceName}" with the role of ${role}.</p>
      <p>Click the following link to accept the invitation and set up your password: <a href="${inviteUrl}">${inviteUrl}</a></p>
    `,
  };
};

/**
 * Generate a workspace invitation email for existing users
 * @param {Object} params - Parameters for the email template
 * @param {string} params.workspaceName - Name of the workspace
 * @param {string} params.role - Role assigned to the user
 * @param {string} params.inviteUrl - URL for accepting the invitation
 * @returns {Object} - Email subject and HTML content
 */
export const existingUserWorkspaceInvitation = ({ workspaceName, role, inviteUrl }) => {
  return {
    subject: `You've been added to ${workspaceName}`,
    html: `
      <p>You have been added to the workspace "${workspaceName}" with the role of ${role}.</p>
      <p>Click the following link to verify your access: <a href="${inviteUrl}">${inviteUrl}</a></p>
    `,
  };
};

/**
 * Generate a schedule invitation email
 * @param {Object} params - Parameters for the email template
 * @param {string} params.meetingPurpose - Purpose of the meeting
 * @param {number} params.meetingDuration - Duration of the meeting in minutes
 * @param {Date} params.startDateRange - Start date range for the meeting
 * @param {Date} params.endDateRange - End date range for the meeting
 * @param {string} params.bookingLink - Link for scheduling the meeting
 * @returns {Object} - Email subject and HTML content
 */
export const scheduleInvitation = ({
  meetingPurpose,
  meetingDuration,
  startDateRange,
  endDateRange,
  bookingLink,
}) => {
  return {
    subject: `Invitation to Schedule a Meeting: ${meetingPurpose}`,
    html: `
      <div>
        <h2>You've Been Invited to Schedule a Meeting</h2>
        <p>You have been invited to schedule a ${meetingDuration} minute meeting about "${meetingPurpose}".</p>
        <p>Please select a time that works for you between ${new Date(
          startDateRange,
        ).toLocaleDateString()} and ${new Date(endDateRange).toLocaleDateString()}.</p>
        </p>
        <div>
          <a href="${bookingLink}">Schedule Meeting</a>
        </div>
        <p>Thank you!</p>
      </div>
    `,
  };
};

/**
 * Generate an approval request email
 * @param {Object} params - Parameters for the email template
 * @param {string} params.moduleName - Name of the module
 * @param {string} params.message - Email message
 * @param {string} params.link - Approval link
 * @returns {Object} - Email HTML content
 */
export const approvalRequest = ({ moduleName, message, link }) => {
  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <p>${message.replace(/\n/g, '<br>')}</p>
        
        <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px;">
          <div style="background-color: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <div style="background-color: #ffebee; border-radius: 8px; padding: 10px; margin-right: 10px;">
                <span style="color: #e91e63;">📄</span>
              </div>
              <div>
                <div style="font-weight: bold;">${moduleName}</div>
                <div style="color: #666; font-size: 14px;">Version 1 • Document</div>
              </div>
            </div>
          </div>
          
          <a href="${link}" style="display: block; background-color: #e91e63; color: white; text-align: center; padding: 12px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-bottom: 15px;">Review and Approve</a>
          
          <div style="text-align: center; color: #666; font-size: 14px; margin-bottom: 15px;">
            <span>💬 Comments are enabled for this review</span>
          </div>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          This request was sent via automated email. If you have any questions, please contact support.
        </div>
      </div>
    `,
  };
};
