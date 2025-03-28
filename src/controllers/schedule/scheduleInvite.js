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
      clientEmails,
      meetingDuration,
      meetingPurpose,
      startDateRange,
      endDateRange,
      projectId,
      meetingLocation,
      customLocation,
    } = req.body;

    // Convert meetingDuration to number and validate
    const duration = parseInt(meetingDuration, 10);
    if (isNaN(duration) || duration <= 0) {
      return next(new AppError('Invalid meeting duration', 400));
    }

    if (
      !clientEmails ||
      !meetingDuration ||
      !meetingPurpose ||
      !startDateRange ||
      !endDateRange ||
      !meetingLocation
    ) {
      return next(new AppError('Missing required fields', 400));
    }

    if (meetingLocation === 'other' && !customLocation) {
      return next(new AppError('Custom location is required when location type is "other"', 400));
    }

    const availability = await Availability.findOne({ userId });

    if (!availability) {
      return next(new AppError('User availability settings not found', 404));
    }

    const bookingToken = crypto.randomBytes(32).toString('hex');

    const booking = await BookingRequest.create({
      userId,
      bookingToken,
      clientEmails,
      meetingDuration: duration,
      meetingPurpose,
      dateRange: {
        start: startDateRange,
        end: endDateRange,
      },
      projectId,
      meetingLocation,
      customLocation,
    });

    const bookingLink = `${process.env.FRONTEND_URL || 'https://hourblock.com'}/booking/${
      booking._id
    }`;

    // Send email to each client
    for (const clientEmail of clientEmails) {
      await emailService.sendEmail({
        to: clientEmail,
        subject: `Invitation to Schedule a Meeting: ${meetingPurpose}`,
        html: `
          <div>
            <h2>You've Been Invited to Schedule a Meeting</h2>
            <p>You have been invited to schedule a ${meetingDuration} minute meeting about "${meetingPurpose}".</p>
            <p>Please select a time that works for you between ${new Date(
              startDateRange,
            ).toLocaleDateString()} and ${new Date(endDateRange).toLocaleDateString()}.</p>
            <p>Meeting location: ${
              meetingLocation === 'other' ? customLocation : meetingLocation
            }</p>
            <div>
              <a href="${bookingLink}">Schedule Meeting</a>
            </div>
            <p>If you have any questions, please reply to this email.</p>
            <p>Thank you!</p>
          </div>
        `,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Schedule invite sent successfully',
      data: {
        clientEmails,
        meetingDuration,
        meetingPurpose,
        dateRange: {
          start: startDateRange,
          end: endDateRange,
        },
        meetingLocation,
        customLocation: meetingLocation === 'other' ? customLocation : undefined,
        bookingLink,
      },
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default scheduleInvite;
