import Client from '../../models/Client.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

// Get all labels for a client
export const getClientLabels = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    }).select('labels');

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res
      .status(200)
      .json(new ApiResponse(200, client.labels || [], 'Labels retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Add a new label to a client
export const addClientLabel = async (req, res, next) => {
  try {
    const { label } = req.body;

    if (!label || typeof label !== 'string') {
      return next(new AppError('Label is required and must be a string', 400));
    }

    const client = await Client.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    if (client.labels.includes(label)) {
      return next(new AppError('Label already exists for this client', 400));
    }

    client.labels.push(label);
    await client.save();

    res.status(201).json(new ApiResponse(201, client.labels, 'Label added successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete a label from a client
export const deleteClientLabel = async (req, res, next) => {
  try {
    const { labelName } = req.params;

    const client = await Client.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    const initialLength = client.labels.length;
    client.labels = client.labels.filter((l) => l !== labelName);

    if (client.labels.length === initialLength) {
      return next(new AppError('Label not found for this client', 404));
    }

    await client.save();

    res.status(200).json(new ApiResponse(200, client.labels, 'Label deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// Update entire labels array for a client
export const updateClientLabels = async (req, res, next) => {
  try {
    const { labels } = req.body;

    if (!Array.isArray(labels)) {
      return next(new AppError('Labels must be an array of strings', 400));
    }

    // Ensure all elements are strings
    if (!labels.every((l) => typeof l === 'string')) {
      return next(new AppError('Each label must be a string', 400));
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { labels },
      { new: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client.labels, 'Labels updated successfully'));
  } catch (error) {
    next(error);
  }
};
