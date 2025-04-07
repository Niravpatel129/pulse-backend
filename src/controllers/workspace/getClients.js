import Client from '../../models/Client.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getClients = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    const clients = await Client.find({ workspace: workspaceId }).populate('user', 'name email');

    res.status(200).json(new ApiResponse(200, clients, 'Clients retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
