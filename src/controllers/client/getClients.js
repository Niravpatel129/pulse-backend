import Client from '../../models/Client.js';
import Payment from '../../models/paymentModel.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get all clients
export const getClients = async (req, res, next) => {
  try {
    const { search } = req.query;

    // Build query
    let query = { workspace: req.workspace._id };

    // Add search condition if search parameter exists
    if (search) {
      query = {
        ...query,
        $or: [
          { 'user.name': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } },
        ],
      };
    }

    // First get all clients with search filter
    const clients = await Client.find(query).sort({ createdAt: -1 });

    // Get total spent for each client by aggregating payments
    const clientPayments = await Payment.aggregate([
      {
        $match: {
          workspace: req.workspace._id,
          status: 'completed',
        },
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      {
        $unwind: '$invoice',
      },
      {
        $group: {
          _id: '$invoice.client',
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    // Create a map of client ID to total spent
    const totalSpentMap = new Map(
      clientPayments.map((payment) => [payment._id.toString(), payment.totalSpent]),
    );

    // Add totalSpent to each client
    const clientsWithTotalSpent = clients.map((client) => {
      const clientObj = client.toObject();
      clientObj.totalSpent = totalSpentMap.get(client._id.toString()) || 0;
      return clientObj;
    });

    res
      .status(200)
      .json(new ApiResponse(200, clientsWithTotalSpent, 'Clients retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
