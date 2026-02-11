import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Center, Spinner, Text, VStack } from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';

export const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, loadUser } = useAuthStore();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const handleAutoLogin = async () => {
      try {
        // Try to get userId from query params first (standard way: /?userId=123)
        let userId = searchParams.get('userId');

        // If not found in query params, try to parse from URL path
        if (!userId) {
          const pathname = window.location.pathname;
          const decodedPath = decodeURIComponent(pathname);

          console.log('[AutoLogin] No userId in query params, checking path...');
          console.log('[AutoLogin] pathname:', pathname);
          console.log('[AutoLogin] decodedPath:', decodedPath);

          // Try format 2: /%3FuserId=123 (decoded to /?userId=123)
          let match = decodedPath.match(/[?&]userId=([^&]+)/);
          if (match) {
            userId = match[1];
            console.log('[AutoLogin] ✅ Found userId in encoded path (format 2):', userId);
          } else {
            // Try format 3: /userId=123 (no ? at all)
            match = pathname.match(/\/userId=([^&/]+)/);
            if (match) {
              userId = match[1];
              console.log('[AutoLogin] ✅ Found userId in direct path (format 3):', userId);
            } else {
              console.log('[AutoLogin] ✗ No userId found in path');
            }
          }
        } else {
          console.log('[AutoLogin] ✅ Found userId in query params (format 1):', userId);
        }

        // If no userId in query params or userId is "lobby" (invalid), check for existing auth session
        if (!userId || userId === 'lobby') {
          // Check if there's a token in localStorage
          const token = localStorage.getItem('auth_token');
          const authStorage = localStorage.getItem('auth-storage');

          console.log('[AutoLogin] No userId, checking existing session...');
          console.log('[AutoLogin] Token exists:', !!token);
          console.log('[AutoLogin] Auth storage exists:', !!authStorage);

          if (token || authStorage) {
            // There's an existing session, try to restore it
            setStatus('Restoring session...');

            try {
              await loadUser();

              // Wait a bit for state to update
              await new Promise(resolve => setTimeout(resolve, 100));

              // Check if user is authenticated after loading
              const authState = useAuthStore.getState();
              console.log('[AutoLogin] Auth state after loadUser:', authState.isAuthenticated, authState.user?.role);

              if (authState.isAuthenticated && authState.user) {
                // User has existing session, redirect based on role
                console.log('[AutoLogin] Session restored, redirecting...');
                if (authState.user.role === 'ORGANIZER') {
                  navigate('/organizer', { replace: true });
                } else {
                  navigate('/lobby', { replace: true });
                }
                return;
              }
            } catch (error) {
              console.error('[AutoLogin] Error restoring session:', error);
            }
          }

          // No existing session or session restore failed, go to login
          console.log('[AutoLogin] No valid session, redirecting to login');
          navigate('/login', { replace: true });
          return;
        }

        console.log('[AutoLogin] Starting auto-login for userId:', userId);
        setStatus('Setting up authentication...');

        // Store userId for app authentication
        localStorage.setItem('app_user_id', userId);

        // Check for saved player name before setting user
        const savedPlayerName = localStorage.getItem('playerName');
        const isDefaultName = (name: string | null): boolean => {
          if (!name) return true;
          return name.startsWith('User ') || name.startsWith('user_');
        };
        const userName = savedPlayerName && !isDefaultName(savedPlayerName)
          ? savedPlayerName
          : `User ${userId}`;

        console.log('[AutoLogin] Saved player name:', savedPlayerName);
        console.log('[AutoLogin] Using name:', userName);

        // Set user object in store with saved name if available
        setUser({
          id: userId,
          email: `user_${userId}@app.com`,
          name: userName,
        });

        console.log('[AutoLogin] User set in store, connecting WebSocket...');
        setStatus('Connecting to game server...');

        // Connect to WebSocket with userId
        wsService.connect(userId);

        // Wait for WebSocket connection with timeout
        const waitForConnection = new Promise<boolean>((resolve) => {
          const checkInterval = setInterval(() => {
            if (wsService.isConnected()) {
              console.log('[AutoLogin] WebSocket connected successfully');
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 100);

          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            if (wsService.isConnected()) {
              resolve(true);
            } else {
              console.warn('[AutoLogin] WebSocket connection timeout, proceeding anyway');
              resolve(false);
            }
          }, 5000);
        });

        await waitForConnection;
        console.log('[AutoLogin] WebSocket status:', wsService.isConnected() ? 'Connected' : 'Not connected');
        setStatus('Redirecting to lobby...');

        // Small delay to ensure connection is stable
        setTimeout(() => {
          navigate('/lobby', { replace: true });
        }, 500);
      } catch (error) {
        console.error('[AutoLogin] Fatal error:', error);
        setStatus('Error occurred, redirecting to login...');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1000);
      }
    };

    handleAutoLogin();
  }, [searchParams, navigate, setUser, loadUser]);

  return (
    <Center h="100vh" bg="gray.900">
      <VStack spacing={4}>
        <Spinner size="xl" color="blue.500" thickness="4px" />
        <Text color="white" fontSize="lg">
          {status}
        </Text>
      </VStack>
    </Center>
  );
};
