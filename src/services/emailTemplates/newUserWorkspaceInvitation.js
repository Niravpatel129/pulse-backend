/**
 * Generate a workspace invitation email for new users with HourBlock styling
 * @param {Object} params - Parameters for the email template
 * @param {string} params.workspaceName - Name of the workspace
 * @param {string} params.role - Role assigned to the user
 * @param {string} params.inviteUrl - URL for accepting the invitation
 * @param {string} params.recipientName - Name of the recipient
 * @returns {Object} - Email subject and HTML content
 */
export const newUserWorkspaceInvitation = ({
  workspaceName,
  role,
  inviteUrl,
  recipientName = 'Colleague',
}) => {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const refNumber = `HB-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;

  return {
    subject: `Invitation to join ${workspaceName}`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join ${workspaceName} | HourBlock</title>
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
                        <td style="font-size: 14px; letter-spacing: 0.5px; padding-left: 8px;">HOURBLOCK POST</td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 12px; margin-right: 8px; color: #bfdbfe; padding-right: 8px;">${today}</td>
                        <td style="background-color: white; border-radius: 2px; padding: 4px;">
                          <span style="color: #1e40af; font-size: 12px; font-weight: bold;">OFFICIAL</span>
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
                  <td width="4" style="background-color: #1e40af;"></td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 14px; opacity: 0.8;">WORKSPACE INVITATION</div>
                    <div style="font-weight: bold;">${workspaceName}</div>
                    <div style="font-size: 14px;">Role: <span style="color: #1d4ed8;">${role}</span></div>
                  </td>
                </tr>
              </table>
              
              <!-- Message content -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: white; border: 1px solid #bfdbfe; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-size: 14px; margin-top: 0;">Dear ${recipientName},</p>
                    <div style="margin: 16px 0; font-size: 14px; line-height: 1.5;">
                      <p>
                        You have been invited to join the workspace <span style="font-weight: bold;">"${workspaceName}"</span> with 
                        the role of <span style="font-weight: bold;">${role}</span>.
                      </p>
                      <p style="margin-top: 12px;">
                        Please use the action button below to accept this invitation and set up your account.
                      </p>
                    </div>
                    
                    <!-- Action button styled like a postal stamp -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 16px;">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" border="0">
                        
                            <tr>
                              <td style="padding-top: 4px;">
                                <a href="${inviteUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 4px; border: 2px solid #1e3a8a; font-weight: bold; letter-spacing: 0.5px; text-decoration: none;">
                                  ACCEPT INVITATION &rarr;
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
                          <p style="margin-top: 0;">If the button doesn't work, copy and paste this link:</p>
                          <p style="margin-top: 4px; word-break: break-all; font-weight: 300;">${inviteUrl}</p>
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
</html>`,
  };
};

/**
 * Generate HTML for HourBlock email template - for direct use in components
 * This is for client-side usage and should not be imported in Node.js directly
 */
export default function generateHourBlockEmailHtml({
  workspaceName = 'Design Team',
  role = 'Editor',
  inviteUrl = 'https://hourblock.app/invite/abc123',
  recipientName = 'Colleague',
}) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const refNumber = `HB-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;

  // Returns the same HTML template as newUserWorkspaceInvitation
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join ${workspaceName} | HourBlock</title>
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
                        <td style="font-size: 14px; letter-spacing: 0.5px; padding-left: 8px;">HOURBLOCK POST</td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 12px; margin-right: 8px; color: #bfdbfe; padding-right: 8px;">${today}</td>
                        <td style="background-color: white; border-radius: 2px; padding: 4px;">
                          <span style="color: #1e40af; font-size: 12px; font-weight: bold;">OFFICIAL</span>
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
                  <td width="4" style="background-color: #1e40af;"></td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 14px; opacity: 0.8;">WORKSPACE INVITATION</div>
                    <div style="font-weight: bold;">${workspaceName}</div>
                    <div style="font-size: 14px;">Role: <span style="color: #1d4ed8;">${role}</span></div>
                  </td>
                </tr>
              </table>
              
              <!-- Message content -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: white; border: 1px solid #bfdbfe; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-size: 14px; margin-top: 0;">Dear ${recipientName},</p>
                    <div style="margin: 16px 0; font-size: 14px; line-height: 1.5;">
                      <p>
                        You have been invited to join the workspace <span style="font-weight: bold;">"${workspaceName}"</span> with 
                        the role of <span style="font-weight: bold;">${role}</span>.
                      </p>
                      <p style="margin-top: 12px;">
                        Please use the action button below to accept this invitation and set up your account.
                      </p>
                    </div>
                    
                    <!-- Action button styled like a postal stamp -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 16px;">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" border="0">
                          
                            <tr>
                              <td style="padding-top: 4px;">
                                <a href="${inviteUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 4px; border: 2px solid #1e3a8a; font-weight: bold; letter-spacing: 0.5px; text-decoration: none;">
                                  ACCEPT INVITATION &rarr;
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
                          <p style="margin-top: 0;">If the button doesn't work, copy and paste this link:</p>
                          <p style="margin-top: 4px; word-break: break-all; font-weight: 300;">${inviteUrl}</p>
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
}
