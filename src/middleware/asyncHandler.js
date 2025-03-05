/**
 * Wraps an async route handler to catch any errors and pass them to the error handling middleware
 * @param {Function} fn - The async route handler function
 * @returns {Function} Wrapped route handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
