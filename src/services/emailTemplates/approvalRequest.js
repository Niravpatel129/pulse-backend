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
