import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

interface TrackEventParams {
  eventName: string;
  properties?: Record<string, any>;
}

const getDeviceId = (): string => {
  const DEVICE_ID_KEY = 'tambola_device_id';
  return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
};

const getAppUserId = (): string | null => {
  // Get userId from localStorage (stored during auto-login from mobile app)
  const rawAppUserId = localStorage.getItem('app_user_id');
  // Filter out invalid userId values like "lobby"
  return rawAppUserId && rawAppUserId !== 'lobby' ? rawAppUserId : null;
};

const getAppendedPlatformEventName = (eventName: string): string => {
  return `${eventName}_WEB`;
};

const sendRudderStackEvent = ({
  eventName,
  properties,
}: {
  eventName: string;
  properties: Record<string, unknown>;
}) => {
  const rudderAnalytics = window.rudderanalytics;

  console.log('[sendRudderStackEvent] Called with:', eventName);
  console.log('[sendRudderStackEvent] RudderAnalytics initialized?:', !!rudderAnalytics);

  if (!rudderAnalytics) {
    console.warn('RudderAnalytics not initialized yet', eventName);
    return;
  }

  try {
    const finalEventName = getAppendedPlatformEventName(eventName);
    console.log('[sendRudderStackEvent] Sending to Rudder:', finalEventName);
    console.log('[sendRudderStackEvent] Properties:', properties);

    // Append platform name to event name for cross-platform analytics tracking
    rudderAnalytics.track(finalEventName, properties);

    console.log('[sendRudderStackEvent] ✅ Event sent successfully:', finalEventName);
  } catch (error) {
    console.error('Event failed to track on RudderStack -', eventName, 'Error -', error);
  }
};

export const useTambolaTracking = () => {
  const { user } = useAuthStore();
  const { playerId, currentGameId } = useGameStore();

  const trackEvent = ({ eventName, properties = {} }: TrackEventParams) => {
    const appUserId = getAppUserId();

    console.log('[useTambolaTracking] trackEvent called');
    console.log('[useTambolaTracking] eventName:', eventName);
    console.log('[useTambolaTracking] properties:', properties);
    console.log('[useTambolaTracking] appUserId from localStorage:', appUserId);
    console.log('[useTambolaTracking] user from authStore:', user);

    // Enrich properties with common data
    const enrichedProperties = {
      ...properties,
      user_id: user?.id || 'anonymous',
      app_user_id: appUserId, // Mobile app userId if available
      user_email: user?.email || null,
      device_id: getDeviceId(),
      platform: 'WEB',
      timestamp: new Date().toISOString(),
      // Add game context if available
      ...(playerId && { player_id: playerId }),
      ...(currentGameId && { game_id: currentGameId }),
    };

    console.log('[useTambolaTracking] enrichedProperties:', enrichedProperties);

    // Send to RudderStack
    const sendEvents = () => {
      console.log('[useTambolaTracking] Sending to RudderStack...');
      sendRudderStackEvent({ eventName, properties: enrichedProperties });
    };

    // Use requestIdleCallback for better performance
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
      window.requestIdleCallback(sendEvents);
    } else {
      sendEvents();
    }
  };

  const identifyUser = (userId: string, traits?: Record<string, any>) => {
    const rudderAnalytics = window.rudderanalytics;

    if (!rudderAnalytics) {
      console.warn('RudderAnalytics not initialized yet for identify');
      return;
    }

    try {
      rudderAnalytics.identify(userId, {
        ...traits,
        device_id: getDeviceId(),
        platform: 'WEB',
      });
    } catch (error) {
      console.error('Failed to identify user', error);
    }
  };

  return {
    trackEvent,
    identifyUser,
  };
};
