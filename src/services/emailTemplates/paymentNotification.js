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
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; background-color: #f9f9f9; padding: 20px;">
        ${
          workspaceLogo
            ? `
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${workspaceLogo}" alt="${workspaceName}" style="max-height: 60px; max-width: 200px;">
          </div>
        `
            : ''
        }
        
        <div style="background-color: #1E1E1E; color: white; border-radius: 12px; padding: 35px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 14px; color: #aaa; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Payment Received</div>
          <div style="font-size: 48px; font-weight: bold; margin-bottom: 15px;">${formattedAmount}</div>
          <div style="color: #aaa; font-size: 16px;">Paid on ${paymentDate}</div>
        </div>
        
        <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="margin-bottom: 25px;">
            <h2 style="color: #1E1E1E; font-size: 20px; margin: 0 0 15px 0;">Payment Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; color: #666; width: 30%;">From</td>
                <td style="padding: 12px 0; font-weight: 500; text-align: right;">${clientName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666; border-top: 1px solid #eee;">To</td>
                <td style="padding: 12px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee;">${workspaceName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666; border-top: 1px solid #eee;">Invoice Number</td>
                <td style="padding: 12px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666; border-top: 1px solid #eee;">Payment Method</td>
                <td style="padding: 12px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee;">${paymentMethod}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666; border-top: 1px solid #eee;">Status</td>
                <td style="padding: 12px 0; font-weight: 500; text-align: right; border-top: 1px solid #eee; color: #10b981;">
                  <span style="display: inline-flex; align-items: center; background-color: #ecfdf5; padding: 4px 12px; border-radius: 20px;">
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
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
              Thank you for your payment. This email serves as a receipt for your records. 
              You can view the full payment details and download a receipt by clicking the button below.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 25px;">
          <a href="${paymentLink}" style="display: inline-block; background-color: #0F766E; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500; font-size: 16px; transition: background-color 0.2s;">View Payment Details</a>
        </div>
        
        <div style="text-align: center; color: #94a3b8; font-size: 13px; margin-top: 30px; line-height: 1.5; padding: 0 20px;">
          <p style="margin: 0 0 10px 0;">This is an automated payment notification from ${workspaceName}.</p>
          <p style="margin: 0;">© ${new Date().getFullYear()} ${workspaceName}. All rights reserved.</p>
        </div>
      </div>
    `,
  };
};
