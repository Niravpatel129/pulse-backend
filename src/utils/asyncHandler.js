/**
 * Utility function to handle async/await errors in controller functions
 * Eliminates the need for try/catch blocks in controllers
 * @param {Function} fn The async controller function to wrap
 * @returns {Function} Express middleware function that catches errors
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
