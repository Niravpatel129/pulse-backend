import mongoose from 'mongoose';

const customFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['shortText', 'longText', 'attachment', 'databaseItem'],
  },
  label: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  attachments: [
    {
      name: String,
      type: String,
      size: Number,
      url: String,
    },
  ],
  selectedItem: {
    id: String,
    position: Number,
    Name: String,
    name: String,
    Price: Number,
  },
  selectedDatabaseId: String,
  alignment: String,
  visibleColumns: {
    type: Map,
    of: Boolean,
  },
  selectedTableName: String,
});

const deliverableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      type: String,
      required: true,
    },
    deliverableType: {
      type: String,
      required: true,
    },
    customDeliverableType: {
      type: String,
      default: '',
    },
    customFields: [customFieldSchema],
    teamNotes: {
      type: String,
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
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

const Deliverable = mongoose.model('Deliverable', deliverableSchema);

export default Deliverable;
