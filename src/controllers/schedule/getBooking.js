import Availability from '../../models/Availability.js';
import BookingRequest from '../../models/BookingRequest.js';
import GoogleCalendar from '../../models/GoogleCalendar.js';
import AppError from '../../utils/AppError.js';

/**
 * Controller for getting booking details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await BookingRequest.findById(bookingId);

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    // Get user's Google Calendar and Availability information
    const [googleCalendar, availability] = await Promise.all([
      GoogleCalendar.findOne({ user: booking.userId }),
      Availability.findOne({ userId: booking.userId }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        booking,
        googleCalendar,
        availability,
      },
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default getBooking;
