/**
 * Generate a schedule invitation email
 * @param {Object} params - Parameters for the email template
 * @param {string} params.meetingPurpose - Purpose of the meeting
 * @param {number} params.meetingDuration - Duration of the meeting in minutes
 * @param {Date} params.startDateRange - Start date range for the meeting
 * @param {Date} params.endDateRange - End date range for the meeting
 * @param {string} params.bookingLink - Link for scheduling the meeting
 * @returns {Object} - Email subject and HTML content
 */
export const scheduleInvitation = ({
  meetingPurpose,
  meetingDuration,
  startDateRange,
  endDateRange,
  bookingLink,
}) => {
  return {
    subject: `Invitation to Schedule a Meeting: ${meetingPurpose}`,
    html: `
      <div>
        <h2>You've Been Invited to Schedule a Meeting</h2>
        <p>You have been invited to schedule a ${meetingDuration} minute meeting about "${meetingPurpose}".</p>
        <p>Please select a time that works for you between ${new Date(
          startDateRange,
        ).toLocaleDateString()} and ${new Date(endDateRange).toLocaleDateString()}.</p>
        </p>
        <div>
          <a href="${bookingLink}">Schedule Meeting</a>
        </div>
        <p>Thank you!</p>
      </div>
    `,
  };
};
