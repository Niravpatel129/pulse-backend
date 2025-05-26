import mongoose from 'mongoose';

const toolSchema = new mongoose.Schema({
  id: {
    type: String,
    enum: ['send_email', 'search_web', 'calendar_lookup'],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

const sectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['system_prompt', 'instructions', 'output_structure', 'examples', 'tools'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: String,
  examples: String,
  tools: [toolSchema],
});

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Agent name is required'],
      trim: true,
    },

    icon: String,
    sections: [sectionSchema],
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Add indexes for better query performance
agentSchema.index({ workspace: 1 });
agentSchema.index({ createdBy: 1 });

const Agent = mongoose.model('Agent', agentSchema);

export default Agent;
