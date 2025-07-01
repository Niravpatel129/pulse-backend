import mongoose from 'mongoose';

const blogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      trim: true,
      lowercase: true,
      maxlength: [200, 'Slug cannot exceed 200 characters'],
    },
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled'],
      default: 'draft',
      required: true,
    },
    tags: {
      type: String,
      default: '',
      trim: true,
    },
    featuredImage: {
      type: String,
      default: '',
      trim: true,
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'SEO title cannot exceed 60 characters'],
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'SEO description cannot exceed 160 characters'],
    },
    publishDate: {
      type: String,
      trim: true,
    },
    publishTime: {
      type: String,
      trim: true,
    },
    categories: {
      type: String,
      default: '',
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace is required'],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
    },
    // Additional metadata
    wordCount: {
      type: Number,
      default: 0,
    },
    readingTime: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound index for workspace and slug uniqueness
blogPostSchema.index({ workspace: 1, slug: 1 }, { unique: true });

// Index for common queries
blogPostSchema.index({ workspace: 1, status: 1 });
blogPostSchema.index({ workspace: 1, createdAt: -1 });
blogPostSchema.index({ workspace: 1, publishedAt: -1 });
blogPostSchema.index({ workspace: 1, categories: 1 });

// Text index for search functionality
blogPostSchema.index({
  title: 'text',
  excerpt: 'text',
  content: 'text',
  tags: 'text',
  categories: 'text',
  author: 'text',
});

// Virtual for formatted publish date
blogPostSchema.virtual('formattedPublishDate').get(function () {
  if (this.publishedAt) {
    return this.publishedAt.toISOString().split('T')[0];
  }
  return null;
});

// Virtual for tag array
blogPostSchema.virtual('tagArray').get(function () {
  return this.tags
    ? this.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
});

// Virtual for category array
blogPostSchema.virtual('categoryArray').get(function () {
  return this.categories
    ? this.categories
        .split(',')
        .map((cat) => cat.trim())
        .filter(Boolean)
    : [];
});

// Pre-save middleware to calculate word count and reading time
blogPostSchema.pre('save', function (next) {
  if (this.isModified('content')) {
    // Calculate word count from content (strip HTML tags for accurate count)
    const textContent = this.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    this.wordCount = textContent ? textContent.split(' ').length : 0;

    // Calculate reading time (200 words per minute average)
    this.readingTime = Math.ceil(this.wordCount / 200);
  }

  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Set scheduledFor when status is scheduled and publishDate/publishTime are provided
  if (this.isModified('status') && this.status === 'scheduled') {
    if (this.publishDate && this.publishTime) {
      this.scheduledFor = new Date(`${this.publishDate}T${this.publishTime}`);
    }
  }

  next();
});

// Query middleware to exclude soft-deleted documents
blogPostSchema.pre(/^find/, function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

export default BlogPost;
