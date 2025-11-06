/**
 * Helper function to send events to Google Tag Manager
 * @param {string} eventName - The name of the event (e.g., 'Deposit', 'Withdrawal')
 * @param {Object} eventData - The event data to send
 */
export const sendGTMEvent = (eventName, eventData = {}) => {
  // Check if dataLayer exists (GTM is loaded)
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...eventData
    });
    console.log(`✅ GTM Event sent: ${eventName}`, eventData);
  } else {
    console.warn('⚠️ GTM dataLayer not available. Event not sent:', eventName);
  }
};

