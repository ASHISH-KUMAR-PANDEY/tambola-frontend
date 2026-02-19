import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Center, Spinner, Text, VStack, Box, Icon } from '@chakra-ui/react';
import { WarningIcon } from '@chakra-ui/icons';

export const FlutterAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('🔐 Processing authentication...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    console.log('[FlutterAuth] Component mounted');

    const processAuth = () => {
      try {
        // Get token from query params
        const token = searchParams.get('token');
        console.log('[FlutterAuth] Token received:', token ? 'YES' : 'NO');

        if (!token) {
          throw new Error('No token provided in query params');
        }

        // Decode base64 token
        console.log('[FlutterAuth] Decoding base64 token...');
        const decoded = atob(token);
        console.log('[FlutterAuth] Decoded:', decoded);

        // Parse JSON
        const payload = JSON.parse(decoded);
        console.log('[FlutterAuth] Parsed payload:', payload);

        // Extract userId
        const userId = payload.userId || payload.id || payload.user_id;

        if (!userId) {
          throw new Error('No userId found in token payload');
        }

        console.log('[FlutterAuth] ✅ userId extracted:', userId);
        setStatus('✅ Authentication successful!');

        // Redirect to existing AutoLogin with userId
        console.log('[FlutterAuth] Redirecting to AutoLogin...');
        setTimeout(() => {
          navigate(`/?userId=${userId}`, { replace: true });
        }, 500);

      } catch (error: any) {
        console.error('[FlutterAuth] ❌ Error processing auth:', error);
        setIsError(true);
        setStatus(error.message || 'Authentication failed');

        // Fallback to login after error
        setTimeout(() => {
          console.log('[FlutterAuth] Redirecting to login...');
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    processAuth();
  }, [searchParams, navigate]);

  return (
    <Center h="100vh" bg="gray.900">
      <VStack spacing={6}>
        <Box position="relative">
          {isError ? (
            <Icon as={WarningIcon} boxSize={16} color="red.500" />
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
            {isError ? 'Authentication Failed' : 'Authenticating...'}
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
              Token received: {searchParams.get('token') ? '✅ Yes' : '❌ No'}
            </Text>
            <Text color="gray.500" fontSize="xs" fontFamily="mono" mt={1}>
              Environment: {import.meta.env.MODE}
            </Text>
            <Text color="gray.500" fontSize="xs" fontFamily="mono" mt={1}>
              Route: /flutter-auth
            </Text>
          </Box>
        )}
      </VStack>
    </Center>
  );
};
