import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Center, Spinner, Text, VStack } from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { apiService } from '../services/api.service';
import { useAuthStore } from '../stores/authStore';
import { useFlutterBridge } from '../hooks/useFlutterBridge';

export const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, loadUser } = useAuthStore();
  const [status, setStatus] = useState('Initializing...');
  const { userId: flutterUserId, isFlutterApp, error: flutterError } = useFlutterBridge();

  useEffect(() => {
    const handleAutoLogin = async () => {
      try {
        // Try to get userId from query params first (standard way: /?userId=123)
        let userId = searchParams.get('userId');

        // If no userId in URL, check if Flutter app will provide one
        if (!userId) {
          // Wait a bit for Flutter bridge to initialize (max 2 seconds)
          const checkFlutterStart = Date.now();
          let flutterChecked = false;

          console.log('[AutoLogin] No userId in URL, checking for Flutter bridge...');
          setStatus('Checking for app authentication...');

          while (Date.now() - checkFlutterStart < 2000 && !flutterChecked) {
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if Flutter bridge has initialized
            if (isFlutterApp) {
              console.log('[AutoLogin] Flutter app detected, waiting for userId from bridge...');
              setStatus('Waiting for authentication from app...');

              // Wait for Flutter to send userId (max 10 seconds)
              const waitStart = Date.now();
              while (!flutterUserId && !flutterError && Date.now() - waitStart < 10000) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }

              if (flutterUserId) {
                userId = flutterUserId;
                console.log('[AutoLogin] ✅ Got userId from Flutter bridge:', userId);
              } else if (flutterError) {
                console.error('[AutoLogin] ❌ Flutter bridge error:', flutterError);
              }

              flutterChecked = true;
              break;
            }
          }

          if (!flutterChecked || !isFlutterApp) {
            console.log('[AutoLogin] Not a Flutter app, proceeding with web flow');
          }
        }

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

        // Validate userId - reject invalid values
        const isValidUserId = (id: string | null): boolean => {
          if (!id) return false;

          // Convert to lowercase for case-insensitive check
          const idLower = id.toLowerCase();

          // List of invalid route names and reserved words
          const invalidValues = [
            'lobby', 'login', 'signup', 'organizer', 'game',
            'waiting-lobby', 'undefined', 'null', 'admin'
          ];

          if (invalidValues.includes(idLower)) {
            console.log('[AutoLogin] ✗ Invalid userId (reserved word):', id);
            return false;
          }

          // UserId should be at least 10 characters (reasonable for ObjectId or UUID)
          if (id.length < 10) {
            console.log('[AutoLogin] ✗ Invalid userId (too short):', id);
            return false;
          }

          return true;
        };

        // If no userId or invalid userId, check for existing auth session
        if (!isValidUserId(userId)) {
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

          // No existing session or session restore failed, redirect to Stage webapp login
          console.log('[AutoLogin] No valid session, redirecting to Stage webapp login');
          const stageLoginUrl = 'https://stage.in/hi/login';
          const returnUrl = encodeURIComponent(window.location.origin);
          window.location.href = `${stageLoginUrl}?isTambolaFlow=true&returnUrl=${returnUrl}`;
          return;
        }

        // TypeScript guard: After isValidUserId check, userId must be a valid string
        if (!userId) return;

        console.log('[AutoLogin] Starting auto-login for userId:', userId);
        setStatus('Setting up authentication...');

        // Store userId for app authentication
        localStorage.setItem('app_user_id', userId);

        // Helper function to check if name is in default format
        const isDefaultName = (name: string | null): boolean => {
          if (!name) return true;
          return name.startsWith('User ') || name.startsWith('user_');
        };

        // Try to fetch user profile from database first
        let userName = `User ${userId}`;
        let userExists = false;
        try {
          console.log('[AutoLogin] Fetching user profile from database...');
          setStatus('Loading your profile...');

          const response = await apiService.getUserProfile(userId);
          if (response.success && response.user) {
            userExists = true;
            if (response.user.name && !isDefaultName(response.user.name)) {
              userName = response.user.name;
              console.log('[AutoLogin] ✓ Found saved name in database:', userName);
              // Save to localStorage for faster access next time
              localStorage.setItem('playerName', userName);
            } else {
              console.log('[AutoLogin] User exists but no custom name saved in database');
            }
          }
        } catch (error: any) {
          console.log('[AutoLogin] Failed to fetch profile from database:', error?.message);
        }

        // If user doesn't exist in database or has no custom name, check localStorage
        if (!userExists || isDefaultName(userName)) {
          console.log('[AutoLogin] Checking localStorage for saved name...');
          const savedPlayerName = localStorage.getItem('playerName');
          if (savedPlayerName && !isDefaultName(savedPlayerName)) {
            userName = savedPlayerName;
            console.log('[AutoLogin] ✓ Found saved name in localStorage:', userName);
          } else {
            console.log('[AutoLogin] No saved name found, will use default and show modal');
          }
        }

        console.log('[AutoLogin] Final user name:', userName);

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
