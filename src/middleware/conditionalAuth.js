import { authenticate } from './auth.js';
import { extractWorkspace } from './workspace.js';

/**
 * Conditional authentication middleware
 * If workspaceId is provided in query, skip authentication (public access)
 * Otherwise, apply normal authentication and workspace extraction
 */
export const conditionalAuth = (req, res, next) => {
  // Check if workspaceId is provided in query
  if (req.query.workspaceId) {
    // Public access - skip authentication
    return next();
  } else {
    // Private access - apply authentication and workspace extraction
    authenticate(req, res, (err) => {
      if (err) {
        return next(err);
      }
      extractWorkspace(req, res, next);
    });
  }
};
