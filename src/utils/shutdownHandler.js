// Global shutdown handler
let isShuttingDown = false;
const shutdownHandlers = new Set();

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, initiating graceful shutdown...`);

  // Set a timeout to force exit after 25 seconds (before Heroku's 30s timeout)
  const forceExitTimeout = setTimeout(() => {
    console.error('[Shutdown] Force exit timeout reached');
    process.exit(1);
  }, 25000);

  try {
    // Run all registered shutdown handlers
    const shutdownPromises = Array.from(shutdownHandlers).map((handler) => handler());
    await Promise.all(shutdownPromises);

    console.log('[Shutdown] Graceful shutdown completed');
    clearTimeout(forceExitTimeout);
    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] Error during shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export shutdown handler registration function
export const registerShutdownHandler = (handler) => {
  shutdownHandlers.add(handler);
};
