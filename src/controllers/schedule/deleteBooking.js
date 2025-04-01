import BookingRequest from '../../models/BookingRequest.js';
import emailService from '../../services/emailService.js';
import googleCalendarService from '../../services/googleCalendarService.js';
import AppError from '../../utils/AppError.js';

const deleteBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { userId } = req.user;

    // Find the booking request
    const bookingRequest = await BookingRequest.findById(bookingId);

    if (!bookingRequest) {
      return next(new AppError('Booking not found', 404));
    }

    // Check if the user has permission to delete this booking
    if (bookingRequest.bookingBy.toString() !== userId) {
      return next(new AppError('You do not have permission to delete this booking', 403));
    }

    // Only send notifications and delete calendar event if the booking is in 'booked' status
    if (bookingRequest.status === 'booked') {
      // If there's a Google Meet link, delete the calendar event
      if (bookingRequest.meetLink) {
        try {
          await googleCalendarService.deleteEvent(userId, bookingRequest.meetLink);
        } catch (error) {
          console.error('Failed to delete Google Calendar event:', error);
          // Continue with booking deletion even if calendar event deletion fails
        }
      }

      // Send cancellation emails to all participants
      const cancellationEmailHtml = `
        <div>
          <h2>Meeting Cancellation Notice</h2>
          <p>The following meeting has been cancelled:</p>
          <ul>
            <li>Purpose: ${bookingRequest.meetingPurpose}</li>
            <li>Duration: ${bookingRequest.meetingDuration} minutes</li>
            <li>Location: ${bookingRequest.meetingLocation}</li>
            ${bookingRequest.meetLink ? `<li>Meeting Link: ${bookingRequest.meetLink}</li>` : ''}
          </ul>
          <p>If you have any questions, please contact the meeting organizer.</p>
        </div>
      `;

      // Send to all client emails
      for (const email of bookingRequest.clientEmails) {
        try {
          await emailService.sendEmail({
            to: email,
            subject: `Meeting Cancellation: ${bookingRequest.meetingPurpose}`,
            html: cancellationEmailHtml,
          });
        } catch (error) {
          console.error(`Failed to send cancellation email to ${email}:`, error);
          // Continue with other emails even if one fails
        }
      }
    }

    // Delete the booking request
    await BookingRequest.findByIdAndDelete(bookingId);

    res.status(200).json({
      status: 'success',
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default deleteBooking;
