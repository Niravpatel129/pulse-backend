import asyncHandler from '../../middleware/asyncHandler.js';
import GoogleCalendar from '../../models/GoogleCalendar.js';

// @desc    Get Google Calendar connection status
// @route   GET /api/calendar/google/status
// @access  Private
const getGoogleStatus = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // Check if user has connected Google Calendar
  const calendarCreds = await GoogleCalendar.findOne({ user: userId });

  if (!calendarCreds) {
    return res.status(200).json({
      connected: false,
      message: 'Google Calendar not connected',
    });
  }

  // Check if tokens are still valid
  const isExpired = calendarCreds.tokenExpiry < new Date();

  return res.status(200).json({
    connected: true,
    isExpired,
    calendarId: calendarCreds.calendarId,
    lastSync: calendarCreds.lastSync,
    isSynced: calendarCreds.isSynced,
  });
});

export default getGoogleStatus;
