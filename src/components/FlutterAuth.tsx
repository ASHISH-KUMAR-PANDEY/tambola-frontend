import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Spinner, Text, VStack, Box, Icon } from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { useAuthStore } from '../stores/authStore';

// Extend window interface for Flutter bridge
declare global {
  interface Window {
    Flutter?: {
      postMessage: (type: string, data: any) => void;
      onMessage: (callback: (message: any) => void) => void;
    };
  }
}

interface FlutterAuthMessage {
  type: string;
  data: {
    token?: string;
    userId?: string;
    timestamp?: string;
  };
}

export const FlutterAuth = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [status, setStatus] = useState('⏳ Initializing...');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    console.log('[FlutterAuth] Component mounted');

    // Wait for Flutter bridge to be injected
    function waitForFlutter(callback: () => void, maxAttempts = 50) {
      let attempts = 0;

      const checkFlutter = setInterval(() => {
        console.log(`[FlutterAuth] Checking for Flutter bridge... Attempt ${attempts + 1}/${maxAttempts}`);

        if (typeof window.Flutter !== 'undefined' && window.Flutter.postMessage) {
          clearInterval(checkFlutter);
          console.log('[FlutterAuth] ✅ Flutter bridge available!');
          callback();
        } else if (++attempts >= maxAttempts) {
          clearInterval(checkFlutter);
          console.error('[FlutterAuth] ❌ Timeout waiting for Flutter bridge');
          setIsError(true);
          setStatus('❌ Flutter connection timeout');

          // Fallback to login after timeout
          setTimeout(() => {
            console.log('[FlutterAuth] Redirecting to login...');
            navigate('/login', { replace: true });
          }, 2000);
        }
      }, 100); // Check every 100ms
    }

    // Initialize communication with Flutter
    waitForFlutter(() => {
      console.log('[FlutterAuth] Starting Flutter communication...');
      setStatus('🔗 Connected to Flutter');

      const Flutter = window.Flutter!;

      // Register listener for messages from Flutter
      Flutter.onMessage(async (message: FlutterAuthMessage) => {
        console.log('[FlutterAuth] 📥 Message received from Flutter:', message);

        // Handle authentication message
        if (message.type === 'auth') {
          setStatus('🔐 Authenticating...');

          try {
            const { token, userId } = message.data;

            // Option 1: Direct userId (if Flutter sends userId directly)
            if (userId && !token) {
              console.log('[FlutterAuth] Using direct userId:', userId);
              await handleDirectUserId(userId);
              return;
            }

            // Option 2: Token-based authentication (more secure)
            if (token) {
              console.log('[FlutterAuth] Validating token with backend...');
              await handleTokenAuth(token);
              return;
            }

            // No valid auth data
            throw new Error('No valid authentication data received');

          } catch (error) {
            console.error('[FlutterAuth] ❌ Authentication error:', error);
            setIsError(true);
            setStatus('❌ Authentication failed');

            setTimeout(() => {
              navigate('/login', { replace: true });
            }, 2000);
          }
        }
      });

      // Tell Flutter we're ready to receive auth data
      console.log('[FlutterAuth] 📤 Sending ready signal to Flutter...');
      Flutter.postMessage('ready', {
        status: 'initialized',
        timestamp: new Date().toISOString(),
        platform: 'WEB',
      });

      setStatus('📱 Waiting for authentication...');
    });

    // Cleanup
    return () => {
      console.log('[FlutterAuth] Component unmounting');
    };
  }, [navigate]);

  // Handle direct userId authentication (simpler, current flow)
  const handleDirectUserId = async (userId: string) => {
    console.log('[FlutterAuth] Storing userId and triggering AutoLogin...');

    // Store userId for AutoLogin component
    localStorage.setItem('app_user_id', userId);

    // Set minimal user object
    setUser({
      id: userId,
      email: `user_${userId}@app.com`,
      name: `User ${userId}`,
    });

    setIsSuccess(true);
    setStatus('✅ Success! Redirecting...');

    // Small delay to show success message
    setTimeout(() => {
      console.log('[FlutterAuth] Navigating to root for AutoLogin...');
      navigate('/', { replace: true });
    }, 500);
  };

  // Handle token-based authentication (more secure)
  const handleTokenAuth = async (token: string) => {
    console.log('[FlutterAuth] Validating token with backend...');

    try {
      const response = await fetch('/api/v1/auth/mobile-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Token validation failed');
      }

      const { userId } = await response.json();
      console.log('[FlutterAuth] ✅ Token validated, userId:', userId);

      // Use the validated userId
      await handleDirectUserId(userId);

    } catch (error) {
      console.error('[FlutterAuth] Token validation error:', error);
      throw error;
    }
  };

  return (
    <Center h="100vh" bg="gray.900">
      <VStack spacing={6}>
        <Box position="relative">
          {isError ? (
            <Icon as={WarningIcon} boxSize={16} color="red.500" />
          ) : isSuccess ? (
            <Icon as={CheckCircleIcon} boxSize={16} color="green.500" />
          ) : (
            <Spinner size="xl" color="brand.500" thickness="4px" speed="0.8s" />
          )}
        </Box>

        <VStack spacing={2}>
          <Text
            color="white"
            fontSize="xl"
            fontWeight="bold"
            textAlign="center"
          >
            {isError ? 'Connection Failed' : isSuccess ? 'Authentication Successful' : 'Connecting to App'}
          </Text>
          <Text
            color="gray.400"
            fontSize="md"
            textAlign="center"
            maxW="300px"
          >
            {status}
          </Text>
        </VStack>

        {/* Debug info (only in development) */}
        {import.meta.env.DEV && (
          <Box
            mt={8}
            p={4}
            bg="gray.800"
            borderRadius="md"
            border="1px solid"
            borderColor="gray.700"
            maxW="400px"
          >
            <Text color="gray.500" fontSize="xs" fontFamily="mono">
              Flutter Bridge: {typeof window.Flutter !== 'undefined' ? '✅ Available' : '❌ Not Found'}
            </Text>
            <Text color="gray.500" fontSize="xs" fontFamily="mono" mt={1}>
              Environment: {import.meta.env.MODE}
            </Text>
          </Box>
        )}
      </VStack>
    </Center>
  );
};
