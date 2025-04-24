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
