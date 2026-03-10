import { Box, Text, VStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import SpinWheel from '../components/SpinWheel';
import { wsService } from '../services/websocket.service';

// Pulse animation for the called number
const pulseKeyframes = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

// Glow animation for the number display
const glowKeyframes = keyframes`
  0%, 100% { text-shadow: 0 0 20px rgba(212, 175, 55, 0.5), 0 0 40px rgba(212, 175, 55, 0.3); }
  50% { text-shadow: 0 0 40px rgba(212, 175, 55, 0.8), 0 0 80px rgba(212, 175, 55, 0.5); }
`;

export default function WheelDisplay() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');

  const [remainingNumbers, setRemainingNumbers] = useState<number[]>(
    Array.from({ length: 90 }, (_, i) => i + 1)
  );
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [wheelSize, setWheelSize] = useState(600);

  const socketListenersAdded = useRef(false);

  // Calculate wheel size based on viewport
  useEffect(() => {
    const updateSize = () => {
      const maxWidth = window.innerWidth * 0.85;
      const maxHeight = window.innerHeight * 0.75;
      setWheelSize(Math.min(maxWidth, maxHeight, 800));
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update remaining numbers when called numbers change
  useEffect(() => {
    const remaining = Array.from({ length: 90 }, (_, i) => i + 1).filter(
      (n) => !calledNumbers.includes(n)
    );
    setRemainingNumbers(remaining);
  }, [calledNumbers]);

  // Connect to WebSocket and setup listeners
  useEffect(() => {
    // Connect with a special wheel-display user ID
    const wheelUserId = `wheel-display-${Date.now()}`;
    wsService.connect(wheelUserId);

    // Setup standard event handlers
    wsService.on({
      onConnected: () => {
        console.log('[WheelDisplay] Connected to WebSocket');
        setIsConnected(true);
      },
      onDisconnected: () => {
        console.log('[WheelDisplay] Disconnected from WebSocket');
        setIsConnected(false);
        socketListenersAdded.current = false;
      },
      onNumberCalled: (data) => {
        console.log('[WheelDisplay] Received game:numberCalled', data);
        setCalledNumbers((prev) => {
          if (prev.includes(data.number)) return prev;
          return [...prev, data.number];
        });
        setLastCalledNumber(data.number);
        setShowNumber(true);
      },
      onStateSync: (data) => {
        console.log('[WheelDisplay] Received state sync', data);
        setCalledNumbers(data.calledNumbers);
        if (data.calledNumbers.length > 0) {
          setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
          setShowNumber(true);
        }
      },
    });

    // Poll for socket and add wheel-specific listeners
    const addWheelListeners = () => {
      const socket = (wsService as any).socket;
      if (socket && !socketListenersAdded.current) {
        console.log('[WheelDisplay] Adding wheel:spin listener');
        socketListenersAdded.current = true;

        socket.on('wheel:spin', (data: { targetNumber: number; spinDuration: number; gameId: string }) => {
          console.log('[WheelDisplay] Received wheel:spin', data);
          setTargetNumber(data.targetNumber);
          setIsSpinning(true);
          setShowNumber(false);

          // Show number after spin completes
          setTimeout(() => {
            setIsSpinning(false);
            setLastCalledNumber(data.targetNumber);
            setShowNumber(true);
          }, data.spinDuration);
        });

        socket.on('wheel:sync', (data: { calledNumbers: number[]; remainingNumbers: number[] }) => {
          console.log('[WheelDisplay] Received wheel:sync', data);
          setCalledNumbers(data.calledNumbers);
          if (data.calledNumbers.length > 0) {
            setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
            setShowNumber(true);
          }
        });

        // Join game room and request sync
        if (gameId) {
          console.log('[WheelDisplay] Joining game room:', gameId);
          wsService.joinGame(gameId, 'Wheel Display');

          // Request wheel sync after a short delay
          setTimeout(() => {
            console.log('[WheelDisplay] Requesting wheel sync');
            wsService.requestWheelSync(gameId);
          }, 500);
        }
      }
    };

    // Try immediately
    addWheelListeners();

    // Also poll in case socket isn't ready yet
    const interval = setInterval(() => {
      if (!socketListenersAdded.current) {
        addWheelListeners();
      } else {
        clearInterval(interval);
      }
    }, 200);

    return () => {
      clearInterval(interval);
      const socket = (wsService as any).socket;
      if (socket) {
        socket.off('wheel:spin');
        socket.off('wheel:sync');
      }
      wsService.off();
      wsService.disconnect();
    };
  }, [gameId]);

  return (
    <Box
      bg="#0d0d1a"
      minH="100vh"
      minW="100vw"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      {/* Connection status indicator */}
      <Box
        position="absolute"
        top={4}
        right={4}
        display="flex"
        alignItems="center"
        gap={2}
      >
        <Box
          w={3}
          h={3}
          borderRadius="full"
          bg={isConnected ? 'green.500' : 'red.500'}
          boxShadow={isConnected ? '0 0 10px green' : '0 0 10px red'}
        />
        <Text color="gray.500" fontSize="sm">
          {isConnected ? 'Live' : 'Connecting...'}
        </Text>
      </Box>

      <VStack spacing={6}>
        {/* Wheel - Much bigger now */}
        <Box position="relative">
          <SpinWheel
            numbers={remainingNumbers}
            isSpinning={isSpinning}
            targetNumber={targetNumber}
            size={wheelSize}
            spinDuration={3000}
          />
        </Box>

        {/* Last called number display */}
        {showNumber && lastCalledNumber && !isSpinning && (
          <Box
            animation={`${pulseKeyframes} 2s ease-in-out infinite`}
            bg="linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)"
            borderRadius="full"
            px={{ base: 12, md: 20 }}
            py={{ base: 6, md: 10 }}
            boxShadow="0 0 60px rgba(212, 175, 55, 0.6), inset 0 0 20px rgba(255,255,255,0.1)"
            border="4px solid rgba(255,255,255,0.2)"
          >
            <Text
              fontSize={{ base: '60px', md: '100px', lg: '140px' }}
              fontWeight="bold"
              color="white"
              animation={`${glowKeyframes} 2s ease-in-out infinite`}
              textAlign="center"
              lineHeight="1"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
            >
              {lastCalledNumber}
            </Text>
          </Box>
        )}

        {/* Waiting state */}
        {!showNumber && !isSpinning && (
          <Text color="gray.500" fontSize="xl" fontStyle="italic">
            Waiting for spin...
          </Text>
        )}

        {/* Spinning state */}
        {isSpinning && (
          <Text color="#D4AF37" fontSize="2xl" fontWeight="bold">
            Spinning...
          </Text>
        )}
      </VStack>
    </Box>
  );
}
