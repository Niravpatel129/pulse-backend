/**
 * Generate a reminder alert email with postal/envelope styling
 *
 * @param {Object} options
 * @param {string} options.projectName - Name of the project
 * @param {string} options.reminderMessage - The reminder message
 * @param {string} options.projectUrl - URL to the project in the app
 * @param {string} options.resolveUrl - URL to resolve the alert
 * @param {string} options.dismissUrl - URL to dismiss the alert
 * @returns {Object} Email template object with subject and html
 */
export const reminderAlert = ({
  projectName,
  reminderMessage,
  projectUrl,
  resolveUrl,
  dismissUrl,
}) => {
  const subject = `Project Reminder: ${projectName}`;

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const refNumber = `HB-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Reminder: ${projectName} | HourBlock</title>
</head>
<body style="margin: 0; padding: 0; font-family: monospace, 'Courier New', Courier; color: #1e3a8a; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; border: 1px solid #1e40af; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header with postmark and stamp -->
          <tr>
            <td style="background-color: #1e40af; color: white; padding: 12px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="margin-right: 8px; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">HB</td>
                        <td style="width: 1px; background-color: #60a5fa; margin: 0 8px; height: 24px;"></td>
                        <td style="font-size: 14px; letter-spacing: 0.5px; padding-left: 8px;">HOURBLOCK REMINDER</td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 12px; margin-right: 8px; color: #bfdbfe; padding-right: 8px;">${today}</td>
                        <td style="background-color: #dbeafe; border-radius: 2px; padding: 4px;">
                          <span style="color: #1e40af; font-size: 12px; font-weight: bold;">REMINDER</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Blue decorative line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(to right, #60a5fa, #1e40af, #60a5fa);"></td>
          </tr>
          
          <!-- Envelope styling -->
          <tr>
            <td style="background-color: #eff6ff; padding: 24px;">
              <!-- Address block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="4" style="background-color: #3b82f6;"></td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 14px; opacity: 0.8;">PROJECT REMINDER</div>
                    <div style="font-weight: bold;">${projectName}</div>
                  </td>
                </tr>
              </table>
              
              <!-- Message content -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: white; border: 1px solid #bfdbfe; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="padding: 20px;">
                    <div style="margin: 16px 0; font-size: 14px; line-height: 1.5;">
                      <p>
                        This is a reminder for your project <span style="font-weight: bold;">"${projectName}"</span>:
                      </p>
                      <p style="margin-top: 12px; padding: 12px; background-color: #f0f9ff; border-left: 4px solid #3b82f6;">
                        ${reminderMessage}
                      </p>
                      <p style="margin-top: 12px;">
                        Please check the current status and update the project as needed.
                      </p>
                    </div>
                    
                    <!-- Action buttons -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 16px;">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding: 4px;">
                                <a href="${projectUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 4px; border: 2px solid #1e3a8a; font-weight: bold; letter-spacing: 0.5px; text-decoration: none;">
                                  View Project &rarr;
                                </a>
                              </td>
                              <td style="padding: 4px;">
                                <a href="${resolveUrl}" style="display: inline-block; background-color: #047857; color: white; padding: 12px 24px; border-radius: 4px; border: 2px solid #065f46; font-weight: bold; letter-spacing: 0.5px; text-decoration: none;">
                                  Mark Done
                                </a>
                              </td>
                              <td style="padding: 4px;">
                                <a href="${dismissUrl}" style="display: inline-block; background-color: #f3f4f6; color: #4b5563; padding: 12px 24px; border-radius: 4px; border: 2px solid #d1d5db; font-weight: bold; letter-spacing: 0.5px; text-decoration: none;">
                                  Dismiss
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Fallback link -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; font-size: 12px; color: #1e40af; border-top: 1px solid #eff6ff; padding-top: 16px;">
                      <tr>
                        <td>
                          <p style="margin-top: 0;">If the buttons don't work, copy and paste this link:</p>
                          <p style="margin-top: 4px; word-break: break-all; font-weight: 300;">${projectUrl}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Footer with postal markings -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td style="font-size: 12px; color: #1d4ed8;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          &#9993;
                        </td>
                        <td style="padding-left: 4px; vertical-align: middle;">
                          HOURBLOCK DELIVERY SERVICE
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #60a5fa; padding: 4px 8px; border-radius: 2px; background-color: white;">
                      <tr>
                        <td style="font-weight: bold;">REF:</td>
                        <td style="padding-left: 4px;">${refNumber}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
};
