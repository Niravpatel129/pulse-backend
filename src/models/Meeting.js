import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a meeting title'],
    },
    description: {
      type: String,
    },
    date: {
      type: Date,
      required: [true, 'Please add a meeting date'],
    },
    startTime: {
      type: String,
      required: [true, 'Please add a start time'],
    },
    endTime: {
      type: String,
      required: [true, 'Please add an end time'],
    },
    location: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'cancelled'],
      default: 'pending',
    },
    type: {
      type: String,
      required: [true, 'Please add a meeting type'],
    },
    typeDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Please add meeting type details'],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        participant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Participant',
        },
        type: {
          type: String,
          default: 'client',
          enum: ['client', 'team', 'external'],
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('Meeting', meetingSchema);
