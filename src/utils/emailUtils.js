import mime from 'mime-types';

/**
 * Normalizes a message ID by ensuring it has angle brackets
 * @param {string} messageId - The message ID to normalize
 * @returns {string} The normalized message ID
 */
export const normalizeMessageId = (messageId) => {
  if (!messageId) return '';
  messageId = messageId.trim();
  if (!messageId.startsWith('<')) messageId = `<${messageId}`;
  if (!messageId.endsWith('>')) messageId = `${messageId}>`;
  return messageId;
};

/**
 * Parses an email address list string into an array of email objects
 * @param {string} addressList - The address list string to parse
 * @returns {Array<{name: string, email: string}>} Array of parsed email addresses
 */
export const parseAddressList = (addressList) => {
  if (!addressList) return [];

  return addressList.split(',').map((address) => {
    address = address.trim();
    const match = address.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)$/);
    if (match) {
      return {
        name: match[1] || '',
        email: match[2].toLowerCase(),
      };
    }
    return {
      name: '',
      email: address.toLowerCase(),
    };
  });
};

/**
 * Extracts the email address from a From header
 * @param {string} from - The From header value
 * @returns {{name: string, email: string}} The parsed sender information
 */
export const parseFrom = (from) => {
  if (!from) return { name: '', email: '' };

  const match = from.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)$/);
  if (match) {
    return {
      name: match[1] || '',
      email: match[2].toLowerCase(),
    };
  }
  return {
    name: '',
    email: from.toLowerCase(),
  };
};

/**
 * Checks if an email was sent with TLS based on Received headers
 * @param {string[]} receivedHeaders - Array of Received headers
 * @returns {boolean} Whether the email was sent with TLS
 */
export const wasSentWithTLS = (receivedHeaders) => {
  if (!receivedHeaders || !receivedHeaders.length) return false;

  return receivedHeaders.some((header) => {
    const lowerHeader = header.toLowerCase();
    return (
      lowerHeader.includes('tls') || lowerHeader.includes('ssl') || lowerHeader.includes('starttls')
    );
  });
};

/**
 * Determines the content type of a file
 * @param {string} filename - The filename to check
 * @param {string} mimeType - Optional mime type to use
 * @returns {string} The determined content type
 */
export const getContentType = (filename, mimeType) => {
  if (mimeType) return mimeType;
  return mime.lookup(filename) || 'application/octet-stream';
};

/**
 * Sanitizes HTML content for email display
 * @param {string} html - The HTML content to sanitize
 * @returns {string} The sanitized HTML
 */
export const sanitizeHtml = (html) => {
  if (!html) return '';

  // Basic sanitization - remove potentially dangerous tags and attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/javascript:/gi, '');
};

/**
 * Converts HTML to plain text
 * @param {string} html - The HTML content to convert
 * @returns {string} The plain text version
 */
export const htmlToText = (html) => {
  if (!html) return '';

  return html
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Formats an email address for display
 * @param {string} name - The display name
 * @param {string} email - The email address
 * @returns {string} The formatted email address
 */
export const formatEmailAddress = (name, email) => {
  if (!email) return '';
  if (!name) return email;
  return `"${name}" <${email}>`;
};

/**
 * Extracts email addresses from a string
 * @param {string} text - The text to extract from
 * @returns {string[]} Array of found email addresses
 */
export const extractEmailAddresses = (text) => {
  if (!text) return [];

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
};
