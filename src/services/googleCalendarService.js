import { google } from 'googleapis';
import GoogleCalendar from '../models/GoogleCalendar.js';
import AppError from '../utils/AppError.js';

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  /**
   * Get Google Calendar credentials for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Google Calendar credentials
   */
  async getCalendarCredentials(userId) {
    const calendarCreds = await GoogleCalendar.findOne({ user: userId });
    if (!calendarCreds) {
      throw new AppError('Google Calendar not connected', 404);
    }
    return calendarCreds;
  }

  /**
   * Generate a Google Meet link for a meeting
   * @param {string} userId - User ID
   * @param {Object} meetingDetails - Meeting details
   * @param {string} meetingDetails.title - Meeting title
   * @param {string} meetingDetails.description - Meeting description
   * @param {Date} meetingDetails.startTime - Meeting start time
   * @param {Date} meetingDetails.endTime - Meeting end time
   * @returns {Promise<string>} Google Meet link
   */
  async generateMeetLink(userId, meetingDetails) {
    try {
      const calendarCreds = await this.getCalendarCredentials(userId);

      // Set up credentials
      this.oauth2Client.setCredentials({
        access_token: calendarCreds.accessToken,
        refresh_token: calendarCreds.refreshToken,
      });

      // Create calendar instance
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Create calendar event with Google Meet
      const event = {
        summary: meetingDetails.title,
        description: meetingDetails.description,
        start: {
          dateTime: meetingDetails.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: meetingDetails.endTime.toISOString(),
          timeZone: 'UTC',
        },
        conferenceData: {
          createRequest: {
            requestId: `${userId}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };

      const response = await calendar.events.insert({
        calendarId: calendarCreds.calendarId,
        requestBody: event,
        conferenceDataVersion: 1,
      });

      // Extract Meet link from the response
      const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri;
      if (!meetLink) {
        throw new AppError('Failed to generate Google Meet link', 500);
      }

      return meetLink;
    } catch (error) {
      console.error('Error generating Google Meet link:', error);
      throw new AppError('Failed to generate Google Meet link', 500);
    }
  }
}

export default new GoogleCalendarService();
