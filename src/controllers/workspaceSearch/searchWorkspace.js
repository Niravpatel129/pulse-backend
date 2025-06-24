import asyncHandler from '../../middleware/asyncHandler.js';
import Client from '../../models/Client.js';
import Email from '../../models/Email.js';
import Invoice2 from '../../models/invoice2.js';
import Project from '../../models/Project.js';
import AppError from '../../utils/AppError.js';

/**
 * Universal workspace search across multiple entity types
 * Supports searching clients, invoices, emails, etc.
 */
export const searchWorkspace = asyncHandler(async (req, res, next) => {
  const { query, types, limit = 20, page = 1 } = req.query;
  const workspaceId = req.workspace._id;

  if (!query || query.trim().length < 2) {
    return next(new AppError('Search query must be at least 2 characters long', 400));
  }

  const searchQuery = query.trim();
  const searchLimit = Math.min(parseInt(limit) || 20, 50); // Max 50 results
  const searchPage = Math.max(parseInt(page) || 1, 1);
  const skip = (searchPage - 1) * searchLimit;

  // Default search types if none specified
  const searchTypes = types ? types.split(',') : ['clients', 'invoices', 'emails'];

  const results = {
    query: searchQuery,
    totalResults: 0,
    results: [],
    pagination: {
      page: searchPage,
      limit: searchLimit,
      hasMore: false,
    },
  };

  // Build search promises for each entity type
  const searchPromises = [];

  // Search Clients
  if (searchTypes.includes('clients')) {
    searchPromises.push(searchClients(workspaceId, searchQuery, searchLimit, skip));
  }

  // Search Invoices (both invoice models)
  if (searchTypes.includes('invoices')) {
    searchPromises.push(searchInvoices(workspaceId, searchQuery, searchLimit, skip));
  }

  // Search Emails
  if (searchTypes.includes('emails')) {
    searchPromises.push(searchEmails(workspaceId, searchQuery, searchLimit, skip));
  }

  try {
    // Execute all searches in parallel
    const searchResults = await Promise.allSettled(searchPromises);

    // Combine and sort results
    const allResults = [];

    searchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        allResults.push(...result.value);
      }
    });

    // Sort by relevance (you can customize this scoring)
    allResults.sort((a, b) => {
      // Prioritize exact matches in titles/names
      const aExact =
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const bExact =
        b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then by updated date (most recent first)
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });

    // Apply pagination to combined results
    const startIndex = skip;
    const endIndex = startIndex + searchLimit;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    results.totalResults = allResults.length;
    results.results = paginatedResults;
    results.pagination.hasMore = allResults.length > endIndex;

    res.status(200).json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    console.error('Workspace search error:', error);
    return next(new AppError('Search failed. Please try again.', 500));
  }
});

// Helper functions for searching specific entity types

async function searchClients(workspaceId, query, limit, skip) {
  const searchRegex = new RegExp(query, 'i');

  const clients = await Client.find({
    workspace: workspaceId,
    $or: [
      { 'user.name': searchRegex },
      { 'user.email': searchRegex },
      { phone: searchRegex },
      { 'contact.firstName': searchRegex },
      { 'contact.lastName': searchRegex },
      { website: searchRegex },
      { internalNotes: searchRegex },
    ],
  })
    .select('user phone contact website internalNotes createdAt updatedAt')
    .lean();

  return clients.map((client) => ({
    id: client._id,
    type: 'client',
    title: client.user.name,
    subtitle: client.user.email || client.phone,
    description: `Client • ${client.contact?.firstName || ''} ${
      client.contact?.lastName || ''
    }`.trim(),
    url: `/clients/${client._id}`,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    icon: 'user',
  }));
}

async function searchProjects(workspaceId, query, limit, skip) {
  const searchRegex = new RegExp(query, 'i');

  const projects = await Project.find({
    workspace: workspaceId,
    isArchived: false,
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { projectType: searchRegex },
      { stage: searchRegex },
      { status: searchRegex },
    ],
  })
    .select('name description projectType stage status createdAt updatedAt')
    .lean();

  return projects.map((project) => ({
    id: project._id,
    type: 'project',
    title: project.name,
    subtitle: `${project.stage} • ${project.status}`,
    description: `Project • ${project.description || ''}`.substring(0, 100),
    url: `/projects/${project._id}`,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    icon: 'folder',
  }));
}

async function searchInvoices(workspaceId, query, limit, skip) {
  const searchRegex = new RegExp(query, 'i');

  const invoices = await Invoice2.find({
    workspace: workspaceId,
    $or: [
      { invoiceNumber: searchRegex },
      { notes: searchRegex },
      { 'items.name': searchRegex },
      { 'items.description': searchRegex },
    ],
  })
    .populate('client', 'user.name user.email')
    .select('invoiceNumber status total currency client notes createdAt updatedAt')
    .lean();

  return invoices.map((invoice) => ({
    id: invoice._id,
    type: 'invoice',
    title: `Invoice #${invoice.invoiceNumber}`,
    subtitle: `${invoice.currency} ${invoice.total} • ${invoice.status}`,
    description: `Invoice • ${invoice.client?.user?.name || 'Unknown Client'}`,
    url: `/invoices/${invoice._id}`,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    icon: 'receipt',
  }));
}

async function searchEmails(workspaceId, query, limit, skip) {
  const searchRegex = new RegExp(query, 'i');

  const emails = await Email.find({
    workspace: workspaceId,
    $or: [
      { subject: searchRegex },
      { snippet: searchRegex },
      { 'from.email': searchRegex },
      { 'from.name': searchRegex },
      { 'to.email': searchRegex },
      { 'to.name': searchRegex },
    ],
  })
    .select('subject snippet from to createdAt updatedAt')
    .limit(limit)
    .lean();

  return emails.map((email) => ({
    id: email._id,
    type: 'email',
    title: email.subject || 'No Subject',
    subtitle: `From: ${email.from?.name || email.from?.email || 'Unknown'}`,
    description: `Email • ${email.snippet || ''}`.substring(0, 100),
    url: `/emails/${email._id}`,
    createdAt: email.createdAt,
    updatedAt: email.updatedAt,
    icon: 'mail',
  }));
}
