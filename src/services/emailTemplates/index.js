/**
 * Centralized email templates for the application
 * All email templates are exported from here for consistency
 */

export { approvalRequest } from './approvalRequest.js';
export { existingUserWorkspaceInvitation } from './existingUserWorkspaceInvitation.js';
export { inactivityAlert } from './inactivityAlert.js';
export {
  default as generateHourBlockEmailHtml,
  newUserWorkspaceInvitation,
} from './newUserWorkspaceInvitation.js';
export { paymentNotification } from './paymentNotification.js';
export { reminderAlert } from './reminderAlert.js';
export { scheduleInvitation } from './scheduleInvitation.js';
