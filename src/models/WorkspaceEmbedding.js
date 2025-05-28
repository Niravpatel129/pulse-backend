import mongoose from 'mongoose';

const workspaceEmbeddingSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    text: {
      type: String,
      sparse: true, // Allows null/undefined values
    },
    metadata: {
      type: {
        type: String,
        required: true,
        enum: ['workspace_data', 'user_data', 'project_data', 'custom', 'document'],
        default: 'workspace_data',
      },
      source: String,
      category: String,
      tags: [String],
      customFields: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
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

// Create compound index for efficient querying
workspaceEmbeddingSchema.index({ workspace: 1, 'metadata.type': 1 });
workspaceEmbeddingSchema.index({ workspace: 1, status: 1 });
workspaceEmbeddingSchema.index({ workspace: 1, title: 1 }); // Add index for title searches within workspace

// Add method to check if embedding is valid
workspaceEmbeddingSchema.methods.isValid = function () {
  return this.embedding && Array.isArray(this.embedding) && this.embedding.length > 0;
};

// Add static method to find similar embeddings
workspaceEmbeddingSchema.statics.findSimilar = async function (workspaceId, embedding, limit = 10) {
  // This is a placeholder for vector similarity search
  // You would implement the actual vector similarity search logic here
  // using MongoDB's $vectorSearch or a similar mechanism
  return this.find({
    workspace: workspaceId,
    status: 'active',
  }).limit(limit);
};

const WorkspaceEmbedding = mongoose.model('WorkspaceEmbedding', workspaceEmbeddingSchema);

export default WorkspaceEmbedding;
