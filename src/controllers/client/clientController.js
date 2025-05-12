import Client from '../../models/Client.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

// Get all clients
export const getClients = async (req, res, next) => {
  try {
    const clients = await Client.find({ workspace: req.workspace._id }).sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, clients, 'Clients retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get a single client
export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Create a new client
export const createClient = async (req, res, next) => {
  try {
    const {
      user,
      phone,
      address,
      shippingAddress,
      contact,
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
    } = req.body;

    const client = await Client.create({
      user,
      workspace: req.workspace._id,
      phone,
      address,
      shippingAddress,
      contact,
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
    });

    res.status(201).json(new ApiResponse(201, client, 'Client created successfully'));
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A client with this email already exists in this workspace', 400));
    }
    next(error);
  }
};

// Update a client
export const updateClient = async (req, res, next) => {
  try {
    const {
      user,
      phone,
      address,
      shippingAddress,
      contact,
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
      isActive,
    } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      {
        user,
        phone,
        address,
        shippingAddress,
        contact,
        taxId,
        accountNumber,
        fax,
        mobile,
        tollFree,
        website,
        internalNotes,
        customFields,
        isActive,
      },
      { new: true, runValidators: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client updated successfully'));
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A client with this email already exists in this workspace', 400));
    }
    next(error);
  }
};

// Soft delete a client
export const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, null, 'Client deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// Restore a soft-deleted client
export const restoreClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client restored successfully'));
  } catch (error) {
    next(error);
  }
};
