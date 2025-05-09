import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    zip: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

const contactSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
  },
  { _id: false },
);

const clientSchema = new mongoose.Schema(
  {
    user: {
      type: userSchema,
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    shippingAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    contact: {
      type: contactSchema,
      default: () => ({}),
    },
    taxId: {
      type: String,
      default: '',
    },
    accountNumber: {
      type: String,
      default: '',
    },
    fax: {
      type: String,
      default: '',
    },
    mobile: {
      type: String,
      default: '',
    },
    tollFree: {
      type: String,
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    internalNotes: {
      type: String,
      default: '',
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Create compound index for user email and workspace
clientSchema.index({ 'user.email': 1, workspace: 1 }, { unique: true });

const Client = mongoose.model('Client', clientSchema);

export default Client;
