import Activity from '../../models/Activity.js';
import Client from '../../models/Client.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

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
      contact: contact || {
        firstName: user.name,
      },
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
    });

    // Create activity for client creation
    await Activity.create({
      user: req.user._id,
      workspace: req.workspace._id,
      type: 'client',
      action: 'created',
      description: `Client "${client.user.name}" was created`,
      entityId: client._id,
      entityType: 'client',
      metadata: {
        clientName: client.user.name,
        clientEmail: client.user.email,
      },
    });

    res.status(201).json(new ApiResponse(201, client, 'Client created successfully'));
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A client with this email already exists in this workspace', 400));
    }
    next(error);
  }
};
