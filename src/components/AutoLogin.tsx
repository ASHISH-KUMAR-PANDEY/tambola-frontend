import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Center, Spinner, Text, VStack } from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';

export const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, isAuthenticated, loadUser } = useAuthStore();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const handleAutoLogin = async () => {
      const userId = searchParams.get('userId');

      // If no userId in query params, check for existing auth session
      if (!userId) {
        // Try to restore existing session
        await loadUser();

        // Check if user is authenticated after loading
        const authState = useAuthStore.getState();
        if (authState.isAuthenticated && authState.user) {
          // User has existing session, redirect based on role
          if (authState.user.role === 'ORGANIZER') {
            navigate('/organizer', { replace: true });
          } else {
            navigate('/lobby', { replace: true });
          }
        } else {
          // No existing session, go to login
          navigate('/login', { replace: true });
        }
        return;
      }

      console.log('[AutoLogin] Starting auto-login for userId:', userId);
      setStatus('Setting up authentication...');

      // Store userId for app authentication
      localStorage.setItem('app_user_id', userId);

      // Set minimal user object in store
      setUser({
        id: userId,
        email: `user_${userId}@app.com`,
        name: `User ${userId}`,
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
    };

    handleAutoLogin();
  }, [searchParams, navigate, setUser]);

  return (
    <Center h="100vh" bg="grey.900">
      <VStack spacing={4}>
        <Spinner size="xl" color="brand.500" thickness="4px" />
        <Text color="white" fontSize="lg">
          {status}
        </Text>
      </VStack>
    </Center>
  );
};
