import BookingRequest from '../../models/BookingRequest.js';
import googleCalendarService from '../../services/googleCalendarService.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

const confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { startTime, endTime, guestInfo } = req.body;
    const { guestEmails, name, email, notes } = guestInfo;

    // Find the booking request
    const bookingRequest = await BookingRequest.findById(bookingId).populate(
      'bookingBy',
      'name email',
    );

    if (!bookingRequest) {
      throw new NotFoundError('Booking request not found');
    }

    // Validate that the booking is in pending state
    // if (bookingRequest.status !== 'pending') {
    //   throw new BadRequestError('Booking request is not in pending state');
    // }

    // Validate start time is within the date range
    const scheduledDate = new Date(startTime);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestError('Invalid start time format');
    }

    if (
      scheduledDate < new Date(bookingRequest.dateRange.start) ||
      scheduledDate > new Date(bookingRequest.dateRange.end)
    ) {
      throw new BadRequestError('Start time must be within the requested date range');
    }

    // Validate end time
    const meetingEndTime = new Date(endTime);
    if (isNaN(meetingEndTime.getTime())) {
      throw new BadRequestError('Invalid end time format');
    }

    let meetingLink = null;
    // Create Google Calendar event
    try {
      meetingLink = await googleCalendarService.generateMeetLink(bookingRequest.bookingBy, {
        title: bookingRequest.meetingPurpose,
        description: `Meeting with ${name || 'guest'}\nPurpose: ${bookingRequest.meetingPurpose}`,
        startTime: scheduledDate,
        endTime: meetingEndTime,
        attendees: [
          {
            email: bookingRequest.bookingBy.email,
            name: bookingRequest.bookingBy.name,
            responseStatus: 'needsAction',
          },
          {
            email: email,
            name: name,
            responseStatus: 'needsAction',
          },
          ...guestEmails.map((email) => ({
            email: email,
            name: email,
            responseStatus: 'needsAction',
          })),
        ],
        sendUpdates: 'all', // This ensures invitations are sent
      });
    } catch (error) {
      console.error('Failed to create Google Calendar event:', error);
      // Don't throw error here, just log it since the booking should still be confirmed
    }

    // Update the booking request
    bookingRequest.status = 'booked';
    bookingRequest.scheduledTime = startTime;
    bookingRequest.notes = notes;
    bookingRequest.meetLink = meetingLink;
    await bookingRequest.save();

    // TODO: Send confirmation emails to all client emails

    res.status(200).json({
      success: true,
      data: bookingRequest,
      message: 'Booking confirmed successfully',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error confirming booking',
    });
  }
};

export default confirmBooking;
