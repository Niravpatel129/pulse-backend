import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    templateFieldId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    fieldName: {
      type: String,
      required: true,
    },
    fieldType: {
      type: String,
      required: true,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: '',
    },
    relationType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
    },
    relationTable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
    },
    multiple: {
      type: Boolean,
      default: false,
    },
    fieldValue: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: false },
);

const sectionSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ModuleTemplate',
      required: true,
    },
    templateName: {
      type: String,
      required: true,
    },
    templateDescription: String,
    fields: [fieldSchema],
    sectionId: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const contentSnapshotSchema = new mongoose.Schema(
  {
    sections: [sectionSchema],
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
    },
    fileName: String,
    fileType: String,
    fileSize: Number,
    fileUrl: String,
    figmaUrl: String,
    figmaFileKey: String,
  },
  { _id: false },
);

const versionSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
  },
  contentSnapshot: {
    type: contentSnapshotSchema,
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const approvalSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['not_requested', 'pending', 'approved', 'rejected'],
    default: 'not_requested',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  comment: {
    type: String,
  },
});

const commentSchema = new mongoose.Schema({
  commenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  text: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  statusContext: {
    type: String,
    enum: ['general', 'approval'],
    default: 'general',
  },
});

const projectModuleSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    moduleType: {
      type: String,
      required: true,
      enum: ['file', 'template', 'figma'],
    },
    content: {
      fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
      },
      templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleTemplate',
      },
      figmaUrl: {
        type: String,
      },
      figmaFileKey: {
        type: String,
      },
    },
    versions: [versionSchema],
    currentVersion: {
      type: Number,
      default: 1,
    },
    approval: approvalSchema,
    comments: [commentSchema],
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Unique per project ordering
projectModuleSchema.index({ project: 1, order: 1 }, { unique: true });

// Auto-assign order number on save
projectModuleSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const lastModule = await this.constructor
        .findOne({ project: this.project })
        .sort({ order: -1 })
        .select('order');

      this.order = lastModule ? lastModule.order + 1 : 0;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

projectModuleSchema.pre('validate', function (next) {
  const moduleType = this.moduleType;
  const content = this.content || {};

  if (moduleType === 'file' && !content.fileId) {
    return next(new Error('File ID is required for file modules'));
  } else if (moduleType === 'template') {
    // For template modules, we now check if there are sections in the latest version
    const latestVersion = this.versions[this.versions.length - 1];
    if (
      !latestVersion ||
      !latestVersion.contentSnapshot.sections ||
      latestVersion.contentSnapshot.sections.length === 0
    ) {
      return next(new Error('At least one section is required for template modules'));
    }
  } else if (moduleType === 'figma' && !content.figmaUrl) {
    return next(new Error('Figma URL is required for figma modules'));
  }

  next();
});

// Update `updatedAt` on save
projectModuleSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ProjectModule = mongoose.model('ProjectModule', projectModuleSchema);
export default ProjectModule;
