import mongoose from 'mongoose';

const customElementSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    elementTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ElementTemplate',
    },
    data: mongoose.Schema.Types.Mixed, // Stores the dynamic data based on template
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    strict: false, // Allows for dynamic fields
  },
);

const CustomElement = mongoose.model('CustomElement', customElementSchema);

export default CustomElement;
