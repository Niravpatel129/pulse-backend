import mongoose from 'mongoose';

const blogAnalyticsSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogPost',
      required: true,
      index: true,
    },
    postTitle: {
      type: String,
      required: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    readerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional user ID if logged in
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    readDuration: {
      type: Number,
      required: true,
      min: 0,
    },
    scrollDepth: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    timeOnPage: {
      type: Number,
      required: true,
      min: 0,
    },
    userAgent: {
      type: String,
      required: true,
    },
    referrer: {
      type: String,
      required: false,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: false,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      required: true,
    },
    browser: {
      type: String,
      required: true,
    },
    os: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
blogAnalyticsSchema.index({ workspaceId: 1, postId: 1, timestamp: -1 });
blogAnalyticsSchema.index({ workspaceId: 1, sessionId: 1 });
blogAnalyticsSchema.index({ postId: 1, timestamp: -1 });

// Virtual for engagement level
blogAnalyticsSchema.virtual('engagementLevel').get(function () {
  if (this.scrollDepth >= 70) return 'high';
  if (this.scrollDepth >= 30) return 'medium';
  return 'low';
});

const BlogAnalytics = mongoose.model('BlogAnalytics', blogAnalyticsSchema);

export default BlogAnalytics;
