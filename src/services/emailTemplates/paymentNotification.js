/**
 * Generate a payment notification email
 * @param {Object} params - Parameters for the email template
 * @param {string} params.workspaceName - Name of the workspace
 * @param {string} params.clientName - Name of the client who made the payment
 * @param {number} params.amount - Payment amount
 * @param {string} params.currency - Currency code (USD, EUR, etc.)
 * @param {string} params.invoiceNumber - Invoice number
 * @param {string} params.paymentDate - Formatted payment date
 * @param {string} params.paymentMethod - Payment method (Credit Card, Bank Transfer, etc.)
 * @param {string} params.paymentLink - Link to view the payment details
 * @param {string} params.workspaceLogo - URL to workspace logo (optional)
 * @returns {Object} - Email HTML content
 */
export const paymentNotification = ({
  workspaceName,
  clientName,
  amount,
  currency,
  invoiceNumber,
  paymentDate,
  paymentMethod,
  paymentLink,
  workspaceLogo,
}) => {
  // Format the amount with commas
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);

  return {
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; color: #333; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: #1E1E1E; color: white; border-radius: 8px; padding: 30px; margin-bottom: 15px;">
          <div style="font-size: 40px; font-weight: bold; margin-bottom: 15px;">${currency} ${amount.toFixed(
      2,
    )}</div>
          <div style="color: #aaa; font-size: 16px;">Paid on ${paymentDate}</div>
        </div>
        
        <div style="background-color: white; border-radius: 8px; padding: 25px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #666; width: 30%;">From</td>
              <td style="padding: 10px 0; font-weight: 500; text-align: right;">${clientName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-top: 1px solid #eee;">To</td>
              <td style="padding: 10px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee;">${workspaceName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-top: 1px solid #eee;">Invoice</td>
              <td style="padding: 10px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-top: 1px solid #eee;">Status</td>
              <td style="padding: 10px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee; color: #10b981;">
                <span style="display: inline-flex; align-items: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Paid
                </span>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${paymentLink}" style="display: inline-block; background-color: #0F766E; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; font-size: 16px;">View Details</a>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 13px; margin-top: 25px; line-height: 1.5;">
          <p>This is an automated payment notification from ${workspaceName}.</p>
          <p>© ${new Date().getFullYear()} ${workspaceName}. All rights reserved.</p>
        </div>
      </div>
    `,
  };
};
