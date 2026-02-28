import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Center, Text, VStack, Progress } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { wsService } from '../services/websocket.service';
import { apiService } from '../services/api.service';
import { useAuthStore } from '../stores/authStore';
import { useFlutterBridge } from '../hooks/useFlutterBridge';

const DEBUG_API_URL = 'https://api.tambola.me';

// Pulse animation for the logo/icon
const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

// Send debug logs to backend
const logToBackend = (event: string, data: any = {}) => {
  const payload = {
    source: 'AutoLogin',
    event,
    data,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };
  console.log('[AutoLogin]', event, data);
  fetch(`${DEBUG_API_URL}/api/debug/flutter-bridge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
};

export const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, loadUser } = useAuthStore();
  const [progress, setProgress] = useState(10);
  const hasStarted = useRef(false);

  // Initialize Flutter bridge
  useFlutterBridge();

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasStarted.current) return;
    hasStarted.current = true;

    const handleAutoLogin = async () => {
      try {
        setProgress(15);

        // Try to get userId from query params first
        let userId = searchParams.get('userId');

        // If no userId in URL, check Flutter bridge
        if (!userId) {
          const hasFlutterChannel = !!(window as any).FlutterChannel;
          const maxWait = hasFlutterChannel ? 3000 : 1500; // Shorter wait if no Flutter
          const waitStart = Date.now();

          while (Date.now() - waitStart < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Faster polling

            const windowFlutterUserId = (window as any).__flutterUserId;
            if (windowFlutterUserId) {
              userId = windowFlutterUserId;
              logToBackend('USERID_SOURCE_FLUTTER_JWT', { userId, source: 'Flutter JWT Token' });
              delete (window as any).__flutterUserId;
              break;
            }

            // Early exit if no Flutter channel detected
            if (!hasFlutterChannel && Date.now() - waitStart > 1000) {
              break;
            }
          }
        } else {
          logToBackend('USERID_SOURCE_URL_QUERY', { userId, source: 'URL Query Params' });
        }

        setProgress(30);

        // Try to parse from URL path if still no userId
        if (!userId) {
          const pathname = window.location.pathname;
          const decodedPath = decodeURIComponent(pathname);

          let match = decodedPath.match(/[?&]userId=([^&]+)/);
          if (match) {
            userId = match[1];
          } else {
            match = pathname.match(/\/userId=([^&/]+)/);
            if (match) userId = match[1];
          }
        }

        // Validate userId
        const isValidUserId = (id: string | null): boolean => {
          if (!id) return false;
          const idLower = id.toLowerCase();
          const invalidValues = ['lobby', 'login', 'signup', 'organizer', 'game', 'waiting-lobby', 'undefined', 'null', 'admin'];
          if (invalidValues.includes(idLower)) return false;
          if (id.length < 10) return false;
          return true;
        };

        setProgress(40);

        // Check for existing session if no valid userId
        if (!isValidUserId(userId)) {
          const token = localStorage.getItem('auth_token');
          const authStorage = localStorage.getItem('auth-storage');

          if (token || authStorage) {
            try {
              await loadUser();
              await new Promise(resolve => setTimeout(resolve, 50));

              const authState = useAuthStore.getState();
              if (authState.isAuthenticated && authState.user) {
                logToBackend('USERID_SOURCE_LOCALSTORAGE', {
                  userId: authState.user.id,
                  source: 'LocalStorage Session',
                });
                setProgress(100);
                navigate(authState.user.role === 'ORGANIZER' ? '/organizer' : '/lobby', { replace: true });
                return;
              }
            } catch (error) {
              console.error('[AutoLogin] Error restoring session:', error);
            }
          }

          // Redirect to Stage login
          const stageLoginUrl = 'https://stage.in/hi/login';
          const returnUrl = encodeURIComponent(window.location.origin);
          window.location.href = `${stageLoginUrl}?isTambolaFlow=true&returnUrl=${returnUrl}`;
          return;
        }

        if (!userId) return;

        setProgress(50);

        // Store userId for analytics
        localStorage.setItem('app_user_id', userId);

        // Validate user and get auth token (required for VIP check and other authenticated APIs)
        try {
          await apiService.validateUser(userId);
          logToBackend('AUTH_TOKEN_OBTAINED', { userId });
        } catch (error) {
          logToBackend('AUTH_TOKEN_FAILED', { userId, error: String(error) });
          // Continue anyway - some features may still work
        }

        // Start WebSocket connection early (parallel with profile fetch)
        wsService.connect(userId);

        setProgress(60);

        // Fetch user profile and wait for WebSocket in parallel
        const isDefaultName = (name: string | null): boolean => {
          if (!name) return true;
          return name.startsWith('User ') || name.startsWith('user_');
        };

        let userName = localStorage.getItem('playerName') || `User ${userId.slice(-6)}`;

        // Fetch profile (non-blocking for speed)
        apiService.getUserProfile(userId).then(response => {
          if (response.success && response.user?.name && !isDefaultName(response.user.name)) {
            userName = response.user.name;
            localStorage.setItem('playerName', userName);
            // Update user in store if name changed
            setUser({ id: userId!, email: `user_${userId}@app.com`, name: userName });
          }
        }).catch(() => {});

        setProgress(75);

        // Set user in store immediately with cached/default name
        setUser({
          id: userId,
          email: `user_${userId}@app.com`,
          name: userName,
        });

        // Wait for WebSocket with shorter timeout
        const wsConnected = await new Promise<boolean>((resolve) => {
          const startTime = Date.now();
          const checkInterval = setInterval(() => {
            if (wsService.isConnected()) {
              clearInterval(checkInterval);
              resolve(true);
            } else if (Date.now() - startTime > 3000) {
              clearInterval(checkInterval);
              resolve(false);
            }
          }, 50);
        });

        setProgress(90);

        logToBackend('LOGIN_SUCCESS', { userId, userName, wsConnected });

        setProgress(100);

        // Navigate immediately
        setTimeout(() => {
          navigate('/lobby', { replace: true });
        }, 150);

      } catch (error) {
        console.error('[AutoLogin] Fatal error:', error);
        setTimeout(() => navigate('/login', { replace: true }), 500);
      }
    };

    handleAutoLogin();
  }, [searchParams, navigate, setUser, loadUser]);

  return (
    <Box
      h="100vh"
      w="100vw"
      bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
      position="relative"
      overflow="hidden"
    >
      {/* Background decoration */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="300px"
        h="300px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)"
        filter="blur(40px)"
      />

      <Center h="100%" position="relative" zIndex={1}>
        <VStack spacing={8}>
          {/* Animated game icon */}
          <Box
            animation={`${pulse} 2s ease-in-out infinite`}
            fontSize="64px"
            textShadow="0 0 30px rgba(99, 102, 241, 0.5)"
          >
            🎯
          </Box>

          {/* Hindi text */}
          <VStack spacing={2}>
            <Text
              color="white"
              fontSize="2xl"
              fontWeight="bold"
              textAlign="center"
              textShadow="0 2px 10px rgba(0,0,0,0.3)"
            >
              गेम लोड हो रहा है
            </Text>
            <Text
              color="whiteAlpha.700"
              fontSize="md"
              textAlign="center"
            >
              कृपया प्रतीक्षा करें...
            </Text>
          </VStack>

          {/* Progress bar */}
          <Box w="280px">
            <Progress
              value={progress}
              size="sm"
              colorScheme="purple"
              bg="whiteAlpha.200"
              borderRadius="full"
              hasStripe
              isAnimated
              sx={{
                '& > div': {
                  background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
                }
              }}
            />
            <Text
              color="whiteAlpha.600"
              fontSize="xs"
              textAlign="center"
              mt={2}
            >
              {progress}%
            </Text>
          </Box>
        </VStack>
      </Center>
    </Box>
  );
};
