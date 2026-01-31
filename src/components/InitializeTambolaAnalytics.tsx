import { useEffect } from 'react';

const RUDDERSTACK_ENDPOINT = 'https://stageindiayizr.dataplane.rudderstack.com';

let isLoadingRudderAnalytics = false;

// Extend window interface for RudderStack
declare global {
  interface Window {
    rudderanalytics?: any;
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

            // Track app open
            rudderanalytics.track('tambola_app_opened', {
              deviceId,
              platform: 'WEB',
              timestamp: new Date().toISOString(),
            });
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
