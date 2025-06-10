import mongoose from 'mongoose';

const cmsContentSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    pageType: {
      type: String,
      enum: ['home', 'about', 'services', 'contact', 'custom'],
      default: 'home',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed, // Flexible content structure
      default: {},
    },
    metaData: {
      title: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
      keywords: [String],
      ogImage: String,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Create compound index for workspace and slug uniqueness
cmsContentSchema.index({ workspace: 1, slug: 1 }, { unique: true });

// Create index for published content queries
cmsContentSchema.index({ workspace: 1, isPublished: 1 });

const CmsContent = mongoose.model('CmsContent', cmsContentSchema);

export default CmsContent;
