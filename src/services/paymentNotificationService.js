import User from '../models/User.js';
import emailService from './emailService.js';
import { paymentNotification } from './emailTemplates/index.js';

/**
 * Formats a date as MM/DD/YYYY
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * Safely gets client name from client object, with fallbacks for missing data
 * @param {Object} client - The client object
 * @returns {string} - Client name or fallback text
 */
const getClientName = (client) => {
  if (!client) return 'Client';
  if (!client.user) return client.name || 'Client';

  const firstName = client.user.firstName || '';
  const lastName = client.user.lastName || '';

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return client.user.email || client.name || 'Client';
};

/**
 * Sends payment notification emails to workspace members who have payment notifications enabled
 * @param {Object} payment - The payment object
 * @param {Object} invoice - The invoice object
 * @param {Object} client - The client object
 * @param {Object} workspace - The workspace object
 */
export const sendPaymentNotifications = async (payment, invoice, client, workspace) => {
  try {
    // Find all workspace members with payment notifications enabled
    const notificationMembers = workspace.members.filter(
      (member) => member.notifications && member.notifications.payments,
    );

    if (notificationMembers.length === 0) {
      console.log('No members have payment notifications enabled');
      return;
    }

    // Get user details for each member
    const userIds = notificationMembers.map((member) => member.user);
    const users = await User.find({ _id: { $in: userIds } });

    // Create a map of user IDs to user objects for quick lookup
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    // Generate the payment link
    const domain =
      workspace.customDomains.length > 0
        ? workspace.customDomains[0]
        : `${workspace.subdomain}.hourblock.com`;
    const paymentLink = `https://${domain}/dashboard/invoices?inv=${invoice._id}`;

    // Get client name safely with fallbacks
    const clientName = getClientName(client);

    // Format information for the email template
    const emailData = {
      workspaceName: workspace.name || 'Your Workspace',
      clientName,
      amount: payment.amount,
      currency: invoice.currency || 'USD',
      invoiceNumber: invoice.invoiceNumber || '-',
      paymentDate: formatDate(payment.date),
      paymentMethod: payment.method || 'Online Payment',
      paymentLink,
      workspaceLogo: workspace.logo || '',
    };

    // Generate the email HTML
    const emailTemplate = paymentNotification(emailData);

    // Send notification to each member
    for (const member of notificationMembers) {
      const user = userMap.get(member.user.toString());
      if (!user) continue;

      await emailService.sendEmail({
        to: user.email,
        subject: `Payment Received: ${clientName} - ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: emailData.currency,
        }).format(emailData.amount)}`,
        html: emailTemplate.html,
      });

      console.log(`Payment notification sent to ${user.email}`);
    }
  } catch (error) {
    console.error('Error sending payment notifications:', error);
  }
};
