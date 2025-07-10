/**
 * Detect device type from user agent string
 * @param {string} userAgent - User agent string
 * @returns {string} Device type: 'desktop', 'mobile', or 'tablet'
 */
export const detectDeviceType = (userAgent) => {
  const ua = userAgent.toLowerCase();

  // Check for tablet first (tablets often have mobile in their UA but are larger)
  if (ua.includes('ipad') || ua.includes('tablet') || ua.includes('playbook')) {
    return 'tablet';
  }

  // Check for mobile devices
  if (
    ua.includes('mobile') ||
    ua.includes('android') ||
    ua.includes('iphone') ||
    ua.includes('ipod')
  ) {
    return 'mobile';
  }

  // Default to desktop
  return 'desktop';
};

/**
 * Detect browser from user agent string
 * @param {string} userAgent - User agent string
 * @returns {string} Browser name
 */
export const detectBrowser = (userAgent) => {
  const ua = userAgent.toLowerCase();

  if (ua.includes('chrome') && !ua.includes('edg')) {
    return 'Chrome';
  }
  if (ua.includes('firefox')) {
    return 'Firefox';
  }
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return 'Safari';
  }
  if (ua.includes('edge')) {
    return 'Edge';
  }
  if (ua.includes('opera') || ua.includes('opr')) {
    return 'Opera';
  }
  if (ua.includes('ie') || ua.includes('trident')) {
    return 'Internet Explorer';
  }

  return 'Unknown';
};

/**
 * Detect operating system from user agent string
 * @param {string} userAgent - User agent string
 * @returns {string} Operating system name
 */
export const detectOS = (userAgent) => {
  const ua = userAgent.toLowerCase();

  if (ua.includes('windows')) {
    return 'Windows';
  }
  if (ua.includes('mac os') || ua.includes('macintosh')) {
    return 'macOS';
  }
  if (ua.includes('linux')) {
    return 'Linux';
  }
  if (ua.includes('android')) {
    return 'Android';
  }
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    return 'iOS';
  }

  return 'Unknown';
};

/**
 * Parse user agent and return device information
 * @param {string} userAgent - User agent string
 * @returns {object} Object containing deviceType, browser, and os
 */
export const parseUserAgent = (userAgent) => {
  return {
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
  };
};
