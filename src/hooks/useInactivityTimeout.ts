import { useEffect, useRef, useCallback } from 'react';

interface UseInactivityTimeoutOptions {
  onInactive: () => void;
  timeout?: number; // in milliseconds
  enabled?: boolean;
}

/**
 * Hook to detect user inactivity and trigger callback
 * Tracks mouse moves, clicks, keyboard events, and touch events
 */
export const useInactivityTimeout = ({
  onInactive,
  timeout = 10 * 60 * 1000, // 10 minutes default
  enabled = true,
}: UseInactivityTimeoutOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      console.log('User inactive for', timeout / 1000, 'seconds - logging out');
      onInactive();
    }, timeout);
  }, [enabled, timeout, onInactive]);

  useEffect(() => {
    if (!enabled) return;

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle function to avoid too many resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimeout) {
        resetTimer();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // Throttle to once per second
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledReset);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [enabled, resetTimer]);

  return {
    resetTimer,
    lastActivity: lastActivityRef.current,
  };
};
