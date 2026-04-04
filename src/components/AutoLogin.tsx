import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Text, Progress } from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { apiService } from '../services/api.service';
import { useAuthStore } from '../stores/authStore';
import { useFlutterBridge } from '../hooks/useFlutterBridge';

const DEBUG_API_URL = 'https://api.tambola.me';

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

          // Bypass login — go directly to lobby
          setProgress(100);
          navigate('/lobby', { replace: true });
          return;
        }

        if (!userId) return;

        setProgress(50);

        // Store userId for analytics
        localStorage.setItem('app_user_id', userId);

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

  const confettiPieces = [
    { color: '#FFD700', shape: 'circle', size: 8,  left: '8%',  delay: 0,   duration: 3.2, startY: -5  },
    { color: '#F15F4E', shape: 'rect',   size: 10, left: '15%', delay: 0.5, duration: 3.8, startY: -8  },
    { color: '#4B70B6', shape: 'circle', size: 6,  left: '25%', delay: 1.2, duration: 3.0, startY: -3  },
    { color: '#FFD700', shape: 'rect',   size: 9,  left: '35%', delay: 0.3, duration: 3.5, startY: -10 },
    { color: '#F15F4E', shape: 'circle', size: 7,  left: '45%', delay: 1.8, duration: 3.3, startY: -6  },
    { color: '#92B1DD', shape: 'rect',   size: 8,  left: '55%', delay: 0.8, duration: 3.7, startY: -4  },
    { color: '#FFD700', shape: 'circle', size: 10, left: '65%', delay: 1.5, duration: 3.1, startY: -9  },
    { color: '#F15F4E', shape: 'rect',   size: 6,  left: '72%', delay: 0.2, duration: 3.6, startY: -7  },
    { color: '#4B70B6', shape: 'circle', size: 9,  left: '82%', delay: 1.0, duration: 3.4, startY: -2  },
    { color: '#FFD700', shape: 'rect',   size: 7,  left: '90%', delay: 0.7, duration: 3.9, startY: -11 },
    { color: '#92B1DD', shape: 'circle', size: 8,  left: '12%', delay: 2.0, duration: 3.2, startY: -6  },
    { color: '#F15F4E', shape: 'rect',   size: 11, left: '40%', delay: 1.3, duration: 3.0, startY: -8  },
    { color: '#4B70B6', shape: 'rect',   size: 7,  left: '60%', delay: 2.2, duration: 3.5, startY: -4  },
    { color: '#FFD700', shape: 'circle', size: 6,  left: '78%', delay: 0.9, duration: 3.8, startY: -10 },
    { color: '#F15F4E', shape: 'circle', size: 9,  left: '50%', delay: 1.6, duration: 3.3, startY: -3  },
    { color: '#92B1DD', shape: 'rect',   size: 8,  left: '20%', delay: 2.5, duration: 3.6, startY: -7  },
    { color: '#FFD700', shape: 'rect',   size: 5,  left: '88%', delay: 0.4, duration: 3.1, startY: -5  },
    { color: '#4B70B6', shape: 'circle', size: 10, left: '5%',  delay: 1.9, duration: 3.4, startY: -9  },
  ];

  return (
    <Box
      h="100vh"
      w="100vw"
      position="relative"
      overflow="hidden"
    >
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0; }
          10% { opacity: 1; }
          50% { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
        @keyframes confettiSway {
          0%, 100% { translate: 0 0; }
          25% { translate: 15px 0; }
          75% { translate: -15px 0; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>

      {/* Full-screen SVG background */}
      <Box
        as="img"
        src="/splash-bg.svg"
        alt=""
        position="absolute"
        top="0"
        left="50%"
        transform="translateX(-50%)"
        h="100%"
        minW="100%"
        objectFit="cover"
        objectPosition="center"
      />

      {/* Animated confetti */}
      {confettiPieces.map((p, i) => (
        <Box
          key={i}
          position="absolute"
          top={`${p.startY}%`}
          left={p.left}
          w={`${p.size}px`}
          h={p.shape === 'rect' ? `${p.size * 1.5}px` : `${p.size}px`}
          bg={p.color}
          borderRadius={p.shape === 'circle' ? '50%' : '2px'}
          zIndex={1}
          pointerEvents="none"
          sx={{
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in infinite, confettiSway ${p.duration * 0.8}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}

      {/* Loading indicator overlay */}
      <Box
        position="absolute"
        top="69%"
        left="50%"
        transform="translateX(-50%)"
        zIndex={1}
        w="180px"
      >
        <Progress
          value={progress}
          size="xs"
          bg="whiteAlpha.200"
          borderRadius="full"
          sx={{
            '& > div': {
              background: 'linear-gradient(90deg, #ECC440 0%, #FFFA8A 50%, #DDAC17 100%)',
              borderRadius: 'full',
            }
          }}
        />
        <Text
          color="whiteAlpha.600"
          fontSize="xs"
          textAlign="center"
          mt={2}
        >
          Loading...
        </Text>
      </Box>
    </Box>
  );
};
