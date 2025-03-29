import BookingRequest from '../../models/BookingRequest.js';
import AppError from '../../utils/AppError.js';

/**
 * Controller for getting schedule information by project ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getSchedule = async (req, res, next) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return next(new AppError('Project ID is required', 400));
    }

    // Get all booking requests and meetings for the project
    const [bookingRequests, meetings] = await Promise.all([
      BookingRequest.find({ projectId })
        .populate('bookingBy', 'name email')
        .sort({ createdAt: -1 }),
    ]);

    // Transform the data to match frontend requirements
    const schedule = {
      bookingRequests: bookingRequests.map((booking) => ({
        _id: booking._id,
        meetingPurpose: booking.meetingPurpose,
        meetingDuration: booking.meetingDuration,
        dateRange: booking.dateRange,
        videoPlatform: booking.videoPlatform,
        meetingLocation: booking.meetingLocation,
        customLocation: booking.customLocation,
        status: booking.status,
        scheduledTime: booking.scheduledTime,
        createdBy: booking.bookingBy,
        createdAt: booking.createdAt,
        meetLink: booking.meetLink,
      })),
    };

    res.status(200).json({
      status: 'success',
      data: schedule,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default getSchedule;
