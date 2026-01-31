import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Component to handle user inactivity and auto-logout
 * Should be placed at app root level
 */
export const InactivityHandler = () => {
  const { isAuthenticated, logout, updateActivity, lastActivity } = useAuthStore();
  const navigate = useNavigate();

  // Handle inactivity logout
  const handleInactive = () => {
    if (isAuthenticated) {
      console.log('Logging out due to inactivity');
      logout();
      navigate('/login', { state: { message: 'You were logged out due to inactivity' } });
    }
  };

  // Check if session expired during page reload
  useEffect(() => {
    if (isAuthenticated && lastActivity) {
      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        console.log('Session expired during reload');
        handleInactive();
      }
    }
  }, []); // Run only on mount

  // Set up inactivity tracking
  const { resetTimer } = useInactivityTimeout({
    onInactive: handleInactive,
    timeout: INACTIVITY_TIMEOUT,
    enabled: isAuthenticated,
  });

  // Update activity timestamp in store when user is active
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledUpdate = () => {
      if (!throttleTimeout) {
        updateActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 5000); // Update store once per 5 seconds max
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledUpdate);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledUpdate);
      });
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [isAuthenticated, updateActivity]);

  return null; // This component doesn't render anything
};
