import mongoose from 'mongoose';

const bookingRequestSchema = new mongoose.Schema(
  {
    bookingBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    acceptedInviteInformation: {
      email: {
        type: String,
      },
      name: {
        type: String,
      },
    },
    notes: {
      type: String,
      required: false,
    },
    bookingToken: {
      type: String,
      required: true,
      unique: true,
    },
    clientEmails: {
      type: [String],
      required: true,
    },
    meetingDuration: {
      type: Number,
      required: true,
    },
    meetingPurpose: {
      type: String,
      required: false,
    },
    type: {
      type: String,
      enum: ['video', 'phone', 'other'],
      required: false,
    },
    startTime: {
      type: String,
      required: false,
    },
    endTime: {
      type: String,
      required: false,
    },
    timezone: {
      type: String,
      required: true,
      default: 'UTC',
    },
    dateRange: {
      start: {
        type: Date,
        required: true,
      },
      end: {
        type: Date,
        required: true,
      },
    },
    meetingLocation: {
      type: String,
      required: true,
    },
    videoPlatform: {
      type: String,
      required: false,
    },
    customLocation: {
      type: String,
    },
    phoneNumber: {
      type: String,
      required: false,
    },
    meetLink: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'booked', 'cancelled', 'completed'],
      default: 'pending',
    },
    scheduledTime: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const BookingRequest = mongoose.model('BookingRequest', bookingRequestSchema);

export default BookingRequest;
