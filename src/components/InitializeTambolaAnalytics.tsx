import { useEffect } from 'react';

const RUDDERSTACK_ENDPOINT = 'https://stageindiayizr.dataplane.rudderstack.com';

let isLoadingRudderAnalytics = false;

// Extend window interface for RudderStack
declare global {
  interface Window {
    isRudderAnalyticsInitialized?: boolean;
  }
}

// Generate or retrieve device ID for anonymous tracking
const getOrCreateDeviceId = (): string => {
  const DEVICE_ID_KEY = 'tambola_device_id';

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a unique device ID
    deviceId = `tambola_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
};

// Get app user ID from localStorage OR URL params (fallback for first load)
const getAppUserId = (): string | null => {
  // Filter out invalid userId values
  const invalidValues = ['lobby', 'login', 'signup', 'organizer', 'game', 'waiting-lobby', 'undefined', 'null', 'admin'];

  const isValidUserId = (id: string | null): boolean => {
    if (!id) return false;
    if (invalidValues.includes(id.toLowerCase())) return false;
    if (id.length < 10) return false; // Valid user IDs are longer
    return true;
  };

  // First check localStorage
  const storedUserId = localStorage.getItem('app_user_id');
  if (isValidUserId(storedUserId)) {
    return storedUserId;
  }

  // Fallback: Check URL params (analytics fires before AutoLogin stores it)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    if (isValidUserId(urlUserId)) {
      // Also store it for future events
      localStorage.setItem('app_user_id', urlUserId!);
      return urlUserId;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  return null;
};

export const InitializeTambolaAnalytics = () => {
  useEffect(() => {
    (async () => {
      if (!isLoadingRudderAnalytics && !window?.isRudderAnalyticsInitialized) {
        isLoadingRudderAnalytics = true;

        try {
          const { RudderAnalytics } = await import('@rudderstack/analytics-js');

          const rudderanalytics = new RudderAnalytics();
          window.rudderanalytics = rudderanalytics;
          window.isRudderAnalyticsInitialized = true;

          const deviceId = getOrCreateDeviceId();

          const writeKey = import.meta.env.VITE_RUDDERSTACK_WRITE_KEY || '36sYTD5Z5Pr03SV45SXfSY26ASP';
          const endpoint = import.meta.env.VITE_RUDDERSTACK_ENDPOINT || RUDDERSTACK_ENDPOINT;

          rudderanalytics.load(writeKey, endpoint, {
            integrations: { All: true },
          });

          rudderanalytics.ready(() => {
            rudderanalytics.setAnonymousId(deviceId);
            console.log('Tambola RudderAnalytics initialized successfully');

            const appUserId = getAppUserId();

            // Track app open with app_user_id for user mapping
            rudderanalytics.track('tambola_app_opened', {
              deviceId,
              app_user_id: appUserId,
              platform: 'WEB',
              timestamp: new Date().toISOString(),
            });

            // Also identify user if app_user_id exists
            if (appUserId) {
              rudderanalytics.identify(appUserId, {
                device_id: deviceId,
                platform: 'WEB',
              });
            }
          });
        } catch (error) {
          console.error('RudderStack initialization failed:', error);
          isLoadingRudderAnalytics = false;
        }
      }
    })();
  }, []);

  return null;
};
