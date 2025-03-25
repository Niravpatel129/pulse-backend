import { google } from 'googleapis';
import asyncHandler from '../../middleware/asyncHandler.js';
import GoogleCalendar from '../../models/GoogleCalendar.js';

// Initialize Google Calendar API
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// @desc    Handle Google Calendar OAuth callback
// @route   POST /api/calendar/google/callback
// @access  Public
const handleGoogleCallback = asyncHandler(async (req, res) => {
  const { code, scope, redirectUri } = req.body;

  if (!code) {
    res.status(400);
    throw new Error('Authorization code is required');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });

    const { access_token, refresh_token, expiry_date } = tokens;

    // Get user info from state or from authenticated request
    const userId = req.user?.userId;

    if (!userId) {
      res.status(400);
      throw new Error('User ID is required');
    }

    // Get primary calendar ID
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items.find((cal) => cal.primary);

    // Save or update Google Calendar credentials
    let calendarCreds = await GoogleCalendar.findOne({ user: userId });

    if (calendarCreds) {
      calendarCreds.accessToken = access_token;
      if (refresh_token) calendarCreds.refreshToken = refresh_token;
      calendarCreds.expiryDate = new Date(expiry_date);
      calendarCreds.tokenExpiry = new Date(expiry_date);
      calendarCreds.calendarId = primaryCalendar.id;
      calendarCreds.scope = scope;
      await calendarCreds.save();
    } else {
      calendarCreds = await GoogleCalendar.create({
        user: userId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiryDate: new Date(expiry_date),
        tokenExpiry: new Date(expiry_date),
        calendarId: primaryCalendar.id,
        scope,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Google Calendar connected successfully',
    });
  } catch (error) {
    res.status(400);
    throw new Error(`Failed to connect Google Calendar: ${error.message}`);
  }
});

export default handleGoogleCallback;
