import emailListenerService from '../services/emailListenerService.js';

export function initializeEmailListener() {
  try {
    emailListenerService.start();
    console.log('Email listener service started successfully');
  } catch (error) {
    console.error('Failed to start email listener service:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down email listener...');
  emailListenerService.stop();
});

process.on('SIGINT', () => {
  console.log('Shutting down email listener...');
  emailListenerService.stop();
});
