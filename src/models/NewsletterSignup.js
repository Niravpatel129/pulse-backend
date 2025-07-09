import mongoose from 'mongoose';

const newsletterSignupSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address'],
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
    },
    workspaceName: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
    },
    source: {
      type: String,
      enum: ['command_page', 'website', 'api', 'manual'],
      default: 'command_page',
    },
    status: {
      type: String,
      enum: ['subscribed', 'unsubscribed', 'pending'],
      default: 'subscribed',
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      referrer: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
newsletterSignupSchema.index({ email: 1, workspaceId: 1 }, { unique: true });
newsletterSignupSchema.index({ workspaceId: 1, status: 1 });
newsletterSignupSchema.index({ subscribedAt: -1 });

// Pre-save middleware to ensure email uniqueness per workspace
newsletterSignupSchema.pre('save', async function (next) {
  if (this.isModified('email') || this.isModified('workspaceId')) {
    const existingSignup = await this.constructor.findOne({
      email: this.email,
      workspaceId: this.workspaceId,
      _id: { $ne: this._id },
    });

    if (existingSignup) {
      const error = new Error('Email already subscribed to this workspace newsletter');
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

// Instance method to unsubscribe
newsletterSignupSchema.methods.unsubscribe = function () {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

// Static method to get signup statistics for a workspace
newsletterSignupSchema.statics.getWorkspaceStats = async function (workspaceId) {
  const stats = await this.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    subscribed: 0,
    unsubscribed: 0,
    pending: 0,
  };

  stats.forEach((stat) => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

const NewsletterSignup = mongoose.model('NewsletterSignup', newsletterSignupSchema);

export default NewsletterSignup;
