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
   * @param {Array} [meetingDetails.attendees] - Array of attendees with email and name
   * @param {string} [meetingDetails.sendUpdates] - Whether to send updates to attendees
   * @returns {Promise<string>} Google Meet link
   */
  async generateMeetLink(userId, meetingDetails) {
    try {
      console.log('🚀 meetingDetails:', meetingDetails);
      const calendarCreds = await this.getCalendarCredentials(userId);

      // Set up credentials
      this.oauth2Client.setCredentials({
        access_token: calendarCreds.accessToken,
        refresh_token: calendarCreds.refreshToken,
      });

      // Create calendar instance
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Create calendar event
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
        attendees: meetingDetails.attendees || ['mrmapletv123@gmail.com'],
      };

      // Only try to add Google Meet if there are attendees
      if (meetingDetails.attendees?.length > 0) {
        event.conferenceData = {
          createRequest: {
            requestId: `${userId}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const response = await calendar.events.insert({
        calendarId: calendarCreds.calendarId,
        requestBody: event,
        conferenceDataVersion: event.conferenceData ? 1 : 0,
        sendUpdates: meetingDetails.sendUpdates || 'all',
      });

      // Extract Meet link from the response if available
      const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri;
      if (meetLink) {
        return meetLink;
      }

      // Return null if no Meet link was generated
      return null;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new AppError('Failed to create calendar event', 500);
    }
  }
}

export default new GoogleCalendarService();
