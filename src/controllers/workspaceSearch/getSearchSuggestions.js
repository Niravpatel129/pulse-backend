import asyncHandler from '../../middleware/asyncHandler.js';
import Client from '../../models/Client.js';
import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';

/**
 * Get search suggestions/autocomplete
 */
export const getSearchSuggestions = asyncHandler(async (req, res, next) => {
  const { query, limit = 10 } = req.query;
  const workspaceId = req.workspace._id;

  if (!query || query.trim().length < 1) {
    return res.status(200).json({
      status: 'success',
      data: {
        suggestions: [],
      },
    });
  }

  const searchQuery = query.trim();
  const searchLimit = Math.min(parseInt(limit) || 10, 20);

  try {
    // Get quick suggestions from different entities
    const suggestions = [];

    // Client names
    const clients = await Client.find({
      workspace: workspaceId,
      'user.name': new RegExp(searchQuery, 'i'),
    })
      .select('user.name')
      .limit(3)
      .lean();

    clients.forEach((client) => {
      suggestions.push({
        text: client.user.name,
        type: 'client',
        category: 'Clients',
      });
    });

    // Project names
    // const projects = await Project.find({
    //   workspace: workspaceId,
    //   name: new RegExp(searchQuery, 'i'),
    //   isArchived: false,
    // })
    // .select('name')
    // .limit(3)
    // .lean();

    // projects.forEach((project) => {
    //   suggestions.push({
    //     text: project.name,
    //     type: 'project',
    //     category: 'Projects',
    //   });
    // });

    // Invoice numbers
    const invoices = await Invoice2.find({
      workspace: workspaceId,
      invoiceNumber: new RegExp(searchQuery, 'i'),
    })
      .select('invoiceNumber')
      .limit(3)
      .lean();

    invoices.forEach((invoice) => {
      suggestions.push({
        text: invoice.invoiceNumber,
        type: 'invoice',
        category: 'Invoices',
      });
    });

    res.status(200).json({
      status: 'success',
      data: {
        suggestions: suggestions.slice(0, searchLimit),
      },
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return next(new AppError('Failed to get search suggestions', 500));
  }
});
