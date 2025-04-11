// Helper function to format URL
export const formatUrl = (url) => {
  if (!url) {
    throw new Error('Frontend URL is required');
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};

// Helper function to get workspace URL
export const getWorkspaceUrl = (req) => {
  // Get the host from the request
  const host = req.headers.host;
  const protocol = req.protocol || 'https';

  // If we have a subdomain in the host, use it
  if (host && host.includes('.')) {
    return `${protocol}://${host}`;
  }

  // Fallback to workspace subdomain if available
  if (req.workspace?.subdomain) {
    const baseUrl = formatUrl(process.env.FRONTEND_URL);
    const domain = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${req.workspace.subdomain}.${domain}`;
  }

  throw new Error('Could not determine workspace URL');
};
