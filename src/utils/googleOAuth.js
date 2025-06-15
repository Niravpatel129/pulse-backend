import { google } from 'googleapis';
import computeExpiry from './computeExpiry.js';

// Build an OAuth2 client that automatically persists refreshed tokens
export default function buildOauthClient(integration) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  // Prime the client with the existing tokens
  client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiry?.getTime(),
  });

  // When the Google SDK refreshes tokens, persist them to MongoDB
  client.on('tokens', async (tokens) => {
    try {
      if (tokens.access_token) integration.accessToken = tokens.access_token;
      if (tokens.expiry_date || tokens.expires_in) {
        integration.tokenExpiry = computeExpiry(tokens);
      }

      // Google only sends refresh_token the *first* time consent is granted, but handle it anyway
      if (tokens.refresh_token) {
        integration.refreshToken = tokens.refresh_token;
        integration.refreshTokenLastUsedAt = new Date();
      }

      await integration.save();
    } catch (err) {
      console.error('[OAuth] Failed to persist refreshed token', err);
    }
  });

  return client;
}
