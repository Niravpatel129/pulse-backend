/**
 * Generate an inactivity alert email with action buttons
 *
 * @param {Object} options
 * @param {string} options.projectName - Name of the project
 * @param {number} options.daysSinceActivity - Days since last activity
 * @param {string} options.projectUrl - URL to the project in the app
 * @param {string} options.resolveUrl - URL to resolve the alert directly
 * @param {string} options.dismissUrl - URL to dismiss the alert
 * @returns {Object} Email template object with subject and html
 */
export const inactivityAlert = ({
  projectName,
  daysSinceActivity,
  projectUrl,
  resolveUrl,
  dismissUrl,
}) => {
  const subject = `Stagnant Project Alert: ${projectName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .alert-box {
      background-color: #f8f9fa;
      border-left: 4px solid #ff9900;
      padding: 15px;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      margin: 0 10px 10px 0;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
      text-align: center;
    }
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }
    .btn-success {
      background-color: #28a745;
      color: white;
    }
    .footer {
      font-size: 12px;
      color: #6c757d;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <h2>Project Inactivity Notification</h2>
  
  <div class="alert-box">
    <p><strong>Heads up!</strong> Your project "${projectName}" hasn't had any updates in ${daysSinceActivity} days.</p>
  </div>
  
  <p>Projects without regular updates can fall through the cracks or get forgotten. Would you like to follow up or mark this project as complete?</p>
  
  <p>
    <a href="${projectUrl}" class="btn btn-primary">View Project</a>
    <a href="${resolveUrl}" class="btn btn-success">Mark as Reviewed</a>
    <a href="${dismissUrl}" class="btn btn-secondary">Dismiss Alert</a>
  </p>
  
  <p>If you've been in contact with the client outside the system or have updates to add, visiting the project now will automatically clear this alert.</p>
  
  <div class="footer">
    <p>This is an automated message. If you believe you received this in error, please dismiss the alert.</p>
  </div>
</body>
</html>
  `;

  return { subject, html };
};
