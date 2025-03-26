import crypto from 'crypto';
import Availability from '../../models/Availability.js';
import BookingRequest from '../../models/BookingRequest.js';
import emailService from '../../services/emailService.js';
import AppError from '../../utils/AppError.js';

/**
 * Controller for handling schedule invites
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const scheduleInvite = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const {
      clientEmail,
      meetingDuration,
      meetingPurpose,
      startDateRange,
      endDateRange,
      projectId,
    } = req.body;

    if (!clientEmail || !meetingDuration || !meetingPurpose || !startDateRange || !endDateRange) {
      return next(new AppError('Missing required fields', 400));
    }

    const availability = await Availability.findOne({ userId });

    if (!availability) {
      return next(new AppError('User availability settings not found', 404));
    }

    const bookingToken = crypto.randomBytes(32).toString('hex');

    const booking = await BookingRequest.create({
      userId,
      bookingToken,
      clientEmail,
      meetingDuration,
      meetingPurpose,
      dateRange: {
        start: startDateRange,
        end: endDateRange,
      },
      projectId,
    });

    const bookingLink = `${process.env.FRONTEND_URL || 'https://hourblock.com'}/booking/${
      booking._id
    }`;

    // TODO: Send email to the client
    emailService.sendEmail({
      to: clientEmail,
      subject: `Invitation to Schedule a Meeting: ${meetingPurpose}`,
      html: `
        <div>
          <h2>You've Been Invited to Schedule a Meeting</h2>
          <p>You have been invited to schedule a ${meetingDuration} minute meeting about "${meetingPurpose}".</p>
          <p>Please select a time that works for you between ${new Date(
            startDateRange,
          ).toLocaleDateString()} and ${new Date(endDateRange).toLocaleDateString()}.</p>
          <div>
            <a href="${bookingLink}">Schedule Meeting</a>
          </div>
          <p>If you have any questions, please reply to this email.</p>
          <p>Thank you!</p>
        </div>
      `,
    });

    res.status(200).json({
      status: 'success',
      message: 'Schedule invite sent successfully',
      data: {
        clientEmail,
        meetingDuration,
        meetingPurpose,
        dateRange: {
          start: startDateRange,
          end: endDateRange,
        },
        bookingLink,
      },
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default scheduleInvite;
