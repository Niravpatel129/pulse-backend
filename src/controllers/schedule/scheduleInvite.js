import crypto from 'crypto';
import Availability from '../../models/Availability.js';
import BookingRequest from '../../models/BookingRequest.js';
import emailService from '../../services/emailService.js';
import { scheduleInvitation } from '../../services/emailTemplates.js';
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
      primaryClientEmail,
      meetingDuration,
      meetingPurpose,
      startDateRange,
      endDateRange,
      projectId,
      meetingLocation,
      customLocation,
      videoPlatform,
    } = req.body;

    const workspaceName = req.workspace?.name;
    if (!workspaceName) {
      return next(new AppError('Workspace name not found', 400));
    }

    // Convert meetingDuration to number and validate
    const duration = parseInt(meetingDuration, 10);
    if (isNaN(duration) || duration <= 0) {
      return next(new AppError('Invalid meeting duration', 400));
    }

    if (
      !primaryClientEmail ||
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

    if (meetingLocation === 'video' && !videoPlatform) {
      return next(new AppError('Video platform is required when location type is "video"', 400));
    }

    const availability = await Availability.findOne({ userId });

    if (!availability) {
      return next(new AppError('User availability settings not found', 404));
    }

    const bookingToken = crypto.randomBytes(32).toString('hex');

    const booking = await BookingRequest.create({
      bookingBy: userId,
      bookingToken,
      primaryClientEmail,
      meetingDuration: duration,
      meetingPurpose,
      dateRange: {
        start: startDateRange,
        end: endDateRange,
      },
      projectId,
      meetingLocation,
      customLocation,
      videoPlatform,
    });

    const bookingLink = `${
      process.env.FRONTEND_URL || `https://${workspaceName}.hourblock.com`
    }/portal/booking/${booking._id}`;

    // Send email to the client using the template
    const template = scheduleInvitation({
      meetingPurpose,
      meetingDuration,
      startDateRange,
      endDateRange,
      bookingLink,
    });

    await emailService.sendEmail({
      to: primaryClientEmail,
      subject: template.subject,
      html: template.html,
    });

    res.status(200).json({
      status: 'success',
      message: 'Schedule invite sent successfully',
      data: {
        primaryClientEmail,
        meetingDuration,
        meetingPurpose,
        dateRange: {
          start: startDateRange,
          end: endDateRange,
        },
        meetingLocation,
        videoPlatform,
        customLocation: meetingLocation === 'other' ? customLocation : undefined,
        bookingLink,
      },
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default scheduleInvite;
