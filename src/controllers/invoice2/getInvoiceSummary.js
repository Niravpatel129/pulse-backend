import mongoose from 'mongoose';
import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoiceSummary = catchAsync(async (req, res, next) => {
  const workspace = req.workspace._id;

  // Validate workspace ID
  if (!workspace || !mongoose.Types.ObjectId.isValid(workspace)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid workspace ID',
    });
  }

  // Get summary for each status
  const summary = await Invoice2.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspace),
        status: { $in: ['open', 'paid', 'overdue'] },
      },
    },
    {
      $addFields: {
        // Keep original status
        originalStatus: '$status',
        // Add calculated overdue status for open invoices past due date
        calculatedStatus: {
          $cond: {
            if: {
              $and: [{ $eq: ['$status', 'open'] }, { $lt: ['$dueDate', new Date()] }],
            },
            then: 'overdue_calculated',
            else: '$status',
          },
        },
      },
    },
    {
      $facet: {
        // Get original status summaries
        originalSummary: [
          {
            $group: {
              _id: {
                status: '$originalStatus',
                currency: '$settings.currency',
              },
              total_amount: { $sum: '$totals.total' },
              invoice_count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.status',
              currencies: {
                $push: {
                  currency: '$_id.currency',
                  total_amount: '$total_amount',
                  invoice_count: '$invoice_count',
                },
              },
            },
          },
        ],
        // Get calculated overdue summary
        overdueSummary: [
          {
            $match: {
              calculatedStatus: 'overdue_calculated',
            },
          },
          {
            $group: {
              _id: {
                status: 'overdue',
                currency: '$settings.currency',
              },
              total_amount: { $sum: '$totals.total' },
              invoice_count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.status',
              currencies: {
                $push: {
                  currency: '$_id.currency',
                  total_amount: '$total_amount',
                  invoice_count: '$invoice_count',
                },
              },
            },
          },
        ],
      },
    },
    {
      $project: {
        combined: {
          $concatArrays: ['$originalSummary', '$overdueSummary'],
        },
      },
    },
    {
      $unwind: '$combined',
    },
    {
      $replaceRoot: {
        newRoot: '$combined',
      },
    },
  ]);

  // Format the response
  const formattedSummary = {
    open: { currencies: [] },
    overdue: { currencies: [] },
    paid: { currencies: [] },
  };

  summary.forEach((item) => {
    formattedSummary[item._id] = {
      currencies: item.currencies,
    };
  });

  res.status(200).json({
    status: 'success',
    data: formattedSummary,
  });
});
