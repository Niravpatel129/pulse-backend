import mongoose from 'mongoose';

const googleCalendarSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    tokenExpiry: {
      type: Date,
      required: true,
    },
    calendarId: {
      type: String,
      default: 'primary',
    },
    isSynced: {
      type: Boolean,
      default: false,
    },
    lastSync: {
      type: Date,
    },
    scope: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('GoogleCalendar', googleCalendarSchema);
