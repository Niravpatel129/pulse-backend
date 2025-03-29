import mongoose from 'mongoose';

const bookingRequestSchema = new mongoose.Schema(
  {
    bookingBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
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
      required: true,
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
