import mongoose from 'mongoose';

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
      enum: ['file', 'template'],
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
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Add compound index to ensure unique project-module combinations
// Note: You'll need to redefine what "unique" means in your context
projectModuleSchema.index({ project: 1, order: 1 }, { unique: true });

// Add validation to ensure appropriate content is provided based on moduleType
projectModuleSchema.pre('validate', function (next) {
  const moduleType = this.moduleType;
  const content = this.content || {};

  if (moduleType === 'file' && !content.fileId) {
    return next(new Error('File ID is required for file modules'));
  } else if (moduleType === 'form' && !content.formId) {
    return next(new Error('Form ID is required for form modules'));
  } else if (moduleType === 'template' && !content.templateId) {
    return next(new Error('Template ID is required for template modules'));
  } else if (moduleType === 'text' && !content.text) {
    return next(new Error('Text content is required for text modules'));
  }

  next();
});

// Update the updatedAt field on save
projectModuleSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ProjectModule = mongoose.model('ProjectModule', projectModuleSchema);

export default ProjectModule;
