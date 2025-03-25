import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema(
  {
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const defaultTimeSlot = { start: '09:00', end: '17:00' };

const availabilitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    timezone: {
      type: String,
      default: '',
    },
    minimumNotice: {
      type: Number,
      default: 24,
    },
    bufferTime: {
      type: Number,
      default: 0,
    },
    preventOverlap: {
      type: Boolean,
      default: false,
    },
    requireConfirmation: {
      type: Boolean,
      default: false,
    },
    availabilitySlots: {
      sunday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
      monday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
      tuesday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
      wednesday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
      thursday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
      friday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
      saturday: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        slots: {
          type: [timeSlotSchema],
          default: [defaultTimeSlot],
        },
      },
    },
  },
  { timestamps: true },
);

const Availability = mongoose.model('Availability', availabilitySchema);

export default Availability;
