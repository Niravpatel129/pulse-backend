import mongoose from 'mongoose';

const bookingRequestSchema = new mongoose.Schema(
  {
    userId: {
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
    clientEmail: {
      type: String,
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
