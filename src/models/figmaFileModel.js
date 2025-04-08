import mongoose from 'mongoose';

const figmaFileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name for the Figma file'],
    },
    figmaUrl: {
      type: String,
      required: [true, 'Please provide a Figma URL'],
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Please provide a workspace ID'],
    },
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

const FigmaFile = mongoose.model('FigmaFile', figmaFileSchema);

export default FigmaFile;
