/**
 * Detects if the current device is a mobile device
 * Checks for mobile user agents and touch capabilities
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Mobile device patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
  ];

  // Check if user agent matches mobile patterns
  const isMobileUA = mobilePatterns.some(pattern => pattern.test(userAgent));

  // Also check for touch capability and screen width (additional indicators)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;

  // Consider it mobile if user agent matches OR (has touch AND small screen)
  return isMobileUA || (hasTouchScreen && isSmallScreen);
}

