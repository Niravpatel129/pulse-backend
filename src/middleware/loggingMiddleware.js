import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  // dont execute in dev
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Get original send function
  const originalSend = res.send;

  // Start time for request
  const startTime = Date.now();

  // Override send
  res.send = function (body) {
    // Get username from auth (if available)
    const username = req.user ? req.user.email || req.user.username || 'anonymous' : 'anonymous';

    // Get workspace (if available)
    const workspace =
      req.params.workspaceId ||
      req.query.workspaceId ||
      (req.body && req.body.workspaceId) ||
      'unknown';

    // Get endpoint
    const endpoint = req.originalUrl;

    // Determine success/fail
    const statusCode = res.statusCode;
    const status = statusCode >= 200 && statusCode < 400 ? 'success' : 'fail';

    // Log in desired format
    const logMessage = `[${username}] [${workspace}] [${endpoint}] [${status}] ${statusCode} (${
      Date.now() - startTime
    }ms)`;
    logger.info(logMessage);

    // Call original function
    return originalSend.apply(this, arguments);
  };

  next();
};

export default requestLogger;
