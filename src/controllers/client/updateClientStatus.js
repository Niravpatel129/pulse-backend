import Client from '../../models/Client.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

// Update client status
export const updateClientStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive', 'archived'].includes(status)) {
      return next(
        new AppError('Invalid status. Status must be one of: active, inactive, archived', 400),
      );
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client status updated successfully'));
  } catch (error) {
    next(error);
  }
};
