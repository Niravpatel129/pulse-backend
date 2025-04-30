import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: function () {
        return this.email.split('@')[0];
      },
    },
    avatar: {
      type: String,
    },
    avatarStoragePath: {
      type: String,
    },
    phone: {
      type: String,
    },
    bio: {
      type: String,
    },
    jobTitle: {
      type: String,
    },
    isActivated: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    notificationPreferences: {
      type: Map,
      of: Boolean,
      default: {
        'email-projects': true,
        'email-tasks': true,
        'email-calendar': false,
        'email-billing': true,
      },
    },
    // Add for security tab
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    // Add for billing tab
    billingInfo: {
      companyName: String,
      billingAddress: String,
      taxId: String,
      billingEmail: String,
    },
    // Add for payment methods
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ['credit', 'debit', 'paypal'],
        },
        lastFour: String,
        expiryDate: String,
        isDefault: Boolean,
      },
    ],
    // Track user sessions
    activeSessions: [
      {
        deviceInfo: String,
        location: String,
        lastActive: Date,
        token: String,
      },
    ],
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    needsPasswordChange: {
      type: Boolean,
      default: false,
    },
    billableRate: {
      type: Number,
      default: 0,
    },
    timezone: {
      type: String,
      default: 'America/New_York',
    },
  },
  {
    timestamps: true,
  },
);

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
