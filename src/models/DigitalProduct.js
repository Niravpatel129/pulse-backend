import mongoose from 'mongoose';

const digitalProductSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: function () {
      return new mongoose.Types.ObjectId().toString();
    },
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  originalPrice: {
    type: Number,
    default: null,
  },
  features: [
    {
      type: String,
      required: true,
    },
  ],
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  image: {
    type: String,
    default: null,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: null,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  badge: {
    type: String,
    default: null,
  },
  popular: {
    type: Boolean,
    default: false,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  // Digital product specific fields
  fileUrl: {
    type: String,
    default: null,
  },
  fileSize: {
    type: String,
    default: null,
  },
  fileType: {
    type: String,
    default: null,
  },
  downloadLimit: {
    type: Number,
    default: null, // null means unlimited
  },
  active: {
    type: Boolean,
    default: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for better query performance
digitalProductSchema.index({ workspace: 1, active: 1 });
digitalProductSchema.index({ category: 1, active: 1 });

// Update the updatedAt field before saving
digitalProductSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const DigitalProduct = mongoose.model('DigitalProduct', digitalProductSchema);

export default DigitalProduct;
