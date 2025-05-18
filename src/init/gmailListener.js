import gmailListenerService from '../services/gmailListenerService.js';

export function initializeGmailListener() {
  try {
    console.log('Initializing Gmail listener...');
    gmailListenerService.start();
    console.log('Gmail listener initialized successfully');
  } catch (error) {
    console.error('Failed to start Gmail listener service:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Gmail listener...');
  gmailListenerService.stop();
});

process.on('SIGINT', () => {
  console.log('Shutting down Gmail listener...');
  gmailListenerService.stop();
});
