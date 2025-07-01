/**
 * Convert a string to a URL-friendly slug
 * @param {string} text - The text to slugify
 * @param {object} options - Options for slugification
 * @param {boolean} options.lower - Convert to lowercase (default: true)
 * @param {string} options.separator - Character to use as separator (default: '-')
 * @returns {string} The slugified string
 */
export const slugify = (text, options = {}) => {
  const { lower = true, separator = '-' } = options;

  if (!text) return '';

  let slug = text.toString();

  // Convert to lowercase if requested
  if (lower) {
    slug = slug.toLowerCase();
  }

  // Replace spaces and special characters with separator
  slug = slug
    .trim()
    .replace(/\s+/g, separator) // Replace spaces with separator
    .replace(/[^\w\-]+/g, separator) // Replace non-word chars with separator
    .replace(new RegExp(`\\${separator}+`, 'g'), separator) // Replace multiple separators with single
    .replace(new RegExp(`^\\${separator}+`), '') // Remove separator from start
    .replace(new RegExp(`\\${separator}+$`), ''); // Remove separator from end

  return slug;
};

export default slugify;
