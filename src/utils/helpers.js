/**
 * Generate a unique ID for form elements
 * @returns {string} A random UUID-like string
 */
export const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Format a date string
 * @param {Date|string} date - The date to format
 * @param {string} format - The format to use (default: 'YYYY-MM-DD')
 * @returns {string} The formatted date string
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  let result = format;
  result = result.replace('YYYY', year);
  result = result.replace('MM', month);
  result = result.replace('DD', day);

  return result;
};

/**
 * Truncate a string to a specified length
 * @param {string} str - The string to truncate
 * @param {number} length - The maximum length
 * @param {string} end - The string to append at the end (default: '...')
 * @returns {string} The truncated string
 */
export const truncate = (str, length, end = '...') => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + end;
};

/**
 * Deep clone an object
 * @param {Object} obj - The object to clone
 * @returns {Object} A deep clone of the object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};
