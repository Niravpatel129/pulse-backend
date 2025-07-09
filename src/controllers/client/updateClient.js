import Activity from '../../models/Activity.js';
import Client from '../../models/Client.js';
import Invoice2 from '../../models/invoice2.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

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

    // Handle empty email by setting it to null to avoid unique constraint violations
    const userData = user
      ? {
          ...user,
          email: user.email && user.email.trim() !== '' ? user.email : null,
        }
      : user;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      {
        user: userData,
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

    // Update client information in Invoice2 documents
    await Invoice2.updateMany(
      { 'customer.id': req.params.id },
      {
        $set: {
          'customer.name': client.user.name,
          'customer.email': client.user.email,
        },
      },
    );

    // Create activity for client update
    await Activity.create({
      user: req.user._id,
      workspace: req.workspace._id,
      type: 'client',
      action: 'updated',
      description: `Client "${client.user.name}" information was updated`,
      entityId: client._id,
      entityType: 'client',
      metadata: {
        clientName: client.user.name,
        clientEmail: client.user.email || '', // Provide empty string fallback for null emails
      },
    });

    res.status(200).json(new ApiResponse(200, client, 'Client updated successfully'));
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A client with this email already exists in this workspace', 400));
    }
    next(error);
  }
};
