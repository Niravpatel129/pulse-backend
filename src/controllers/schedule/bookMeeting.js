import crypto from 'crypto';
import BookingRequest from '../../models/BookingRequest.js';
import Participant from '../../models/Participant.js';
import googleCalendarService from '../../services/googleCalendarService.js';
import AppError from '../../utils/AppError.js';

const bookMeeting = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const {
      title,
      type,
      duration = 30,
      participants,
      startTime,
      endTime,
      videoPlatform,
      customLocation,
      phoneNumber,
      fromDate,
      toDate,
      projectId,
      notes,
      timezone = 'UTC',
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !type ||
      !participants ||
      !startTime ||
      !endTime ||
      !fromDate ||
      !toDate ||
      !projectId
    ) {
      return next(new AppError('Missing required fields', 400));
    }

    // Validate meeting type
    if (!['video', 'phone', 'other'].includes(type)) {
      return next(new AppError('Invalid meeting type', 400));
    }

    // Get participant emails
    const participantDetails = await Promise.all(
      participants.map(async (participantId) => {
        const participant = await Participant.findById(participantId);
        if (!participant) {
          throw new AppError(`Participant not found: ${participantId}`, 404);
        }
        return participant.email;
      }),
    );

    // Generate a unique booking token
    const bookingToken = crypto.randomBytes(32).toString('hex');

    // Create booking request in database
    const bookingRequest = await BookingRequest.create({
      bookingBy: userId,
      projectId,
      notes,
      bookingToken,
      clientEmails: participantDetails,
      meetingDuration: duration,
      meetingPurpose: title,
      type,
      startTime,
      endTime,
      timezone,
      dateRange: {
        start: new Date(fromDate),
        end: new Date(toDate),
      },
      meetingLocation:
        type === 'video' ? videoPlatform : type === 'phone' ? phoneNumber : customLocation,
      videoPlatform: type === 'video' ? videoPlatform : undefined,
      customLocation: type === 'other' ? customLocation : undefined,
      phoneNumber: type === 'phone' ? phoneNumber : undefined,
      status: 'booked',
    });

    // Generate Google Meet link if it's a video meeting
    let meetLink = null;
    if (type === 'video' && videoPlatform === 'google-meet') {
      try {
        const attendeeDetails = participantDetails.map((email) => ({
          email,
          responseStatus: 'needsAction',
        }));

        meetLink = await googleCalendarService.generateMeetLink(userId, {
          title,
          description: `Meeting with ${participants.length} participants`,
          startTime: new Date(fromDate),
          endTime: new Date(toDate),
          attendees: attendeeDetails,
          sendUpdates: 'all',
        });

        // Update booking request with meet link
        bookingRequest.meetLink = meetLink;
        await bookingRequest.save();
      } catch (error) {
        console.error('Failed to create Google Calendar event:', error);
        // Don't throw error here, just log it since the booking request should still be created
      }
    }

    // Populate the response with user details
    const populatedBookingRequest = await BookingRequest.findById(bookingRequest._id)
      .populate('bookingBy', 'name email')
      .populate('projectId', 'name');

    res.status(201).json({
      status: 'success',
      data: populatedBookingRequest,
      message: 'Booking request created successfully',
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default bookMeeting;
