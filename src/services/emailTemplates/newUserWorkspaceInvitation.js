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
