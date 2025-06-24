import express from 'express';
import { getSearchSuggestions } from '../controllers/workspaceSearch/getSearchSuggestions.js';
import { searchWorkspace } from '../controllers/workspaceSearch/searchWorkspace.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// All routes require authentication and workspace context
router.use(authenticate);
router.use(extractWorkspace);

/**
 * @route   GET /api/workspace-search
 * @desc    Universal search across workspace entities
 * @access  Private (workspace member)
 * @query   {string} query - Search query (min 2 characters)
 * @query   {string} [types] - Comma-separated entity types to search (clients,projects,invoices,emails,files,notes,deliverables)
 * @query   {number} [limit=20] - Max results per page (max 50)
 * @query   {number} [page=1] - Page number for pagination
 * @example GET /api/workspace-search?query=john&types=clients,projects&limit=10&page=1
 */
router.get('/', searchWorkspace);

/**
 * @route   GET /api/workspace-search/suggestions
 * @desc    Get search suggestions for autocomplete
 * @access  Private (workspace member)
 * @query   {string} query - Search query for suggestions
 * @query   {number} [limit=10] - Max suggestions to return (max 20)
 * @example GET /api/workspace-search/suggestions?query=jo&limit=5
 */
router.get('/suggestions', getSearchSuggestions);

export default router;
