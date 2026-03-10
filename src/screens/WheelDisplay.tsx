import { Box, Text, VStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useEffect, useState, useRef, useCallback } from 'react';
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
  0%, 100% { text-shadow: 0 0 20px rgba(230, 57, 70, 0.5), 0 0 40px rgba(230, 57, 70, 0.3); }
  50% { text-shadow: 0 0 40px rgba(230, 57, 70, 0.8), 0 0 80px rgba(230, 57, 70, 0.5); }
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
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [wheelSize, setWheelSize] = useState(600);

  const socketRef = useRef<any>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate wheel size based on viewport
  useEffect(() => {
    const updateSize = () => {
      const maxWidth = window.innerWidth * 0.85;
      const maxHeight = window.innerHeight * 0.70;
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

  // Handle wheel spin event
  const handleWheelSpin = useCallback((data: { targetNumber: number; spinDuration: number; gameId: string }) => {
    console.log('[WheelDisplay] Received wheel:spin', data);

    // Clear any existing timeout
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
    }

    setTargetNumber(data.targetNumber);
    setIsSpinning(true);
    setShowNumber(false);

    // Show number after spin completes
    spinTimeoutRef.current = setTimeout(() => {
      setIsSpinning(false);
      setLastCalledNumber(data.targetNumber);
      setShowNumber(true);
    }, data.spinDuration);
  }, []);

  // Handle wheel sync event
  const handleWheelSync = useCallback((data: { calledNumbers: number[]; remainingNumbers: number[] }) => {
    console.log('[WheelDisplay] Received wheel:sync', data);
    setCalledNumbers(data.calledNumbers);
    if (data.calledNumbers.length > 0) {
      setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
      setShowNumber(true);
    }
    setIsRoomJoined(true);
  }, []);

  // Connect to WebSocket and setup listeners
  useEffect(() => {
    if (!gameId) {
      console.log('[WheelDisplay] No gameId provided');
      return;
    }

    console.log('[WheelDisplay] Initializing for gameId:', gameId);

    // Connect with a special wheel-display user ID
    const wheelUserId = `wheel-display-${Date.now()}`;
    wsService.connect(wheelUserId);

    // Setup standard event handlers
    wsService.on({
      onConnected: () => {
        console.log('[WheelDisplay] Connected to WebSocket');
        setIsConnected(true);

        // Get raw socket and add wheel-specific listeners
        const socket = (wsService as any).socket;
        if (socket) {
          socketRef.current = socket;

          // Remove any existing listeners first
          socket.off('wheel:spin');
          socket.off('wheel:sync');

          // Add wheel-specific listeners
          socket.on('wheel:spin', handleWheelSpin);
          socket.on('wheel:sync', handleWheelSync);

          console.log('[WheelDisplay] Added wheel listeners, joining game room:', gameId);

          // Join game room
          wsService.joinGame(gameId, 'Wheel Display');

          // Request sync after short delay to ensure room is joined
          setTimeout(() => {
            console.log('[WheelDisplay] Requesting wheel sync');
            wsService.requestWheelSync(gameId);
          }, 500);
        }
      },
      onDisconnected: () => {
        console.log('[WheelDisplay] Disconnected from WebSocket');
        setIsConnected(false);
        setIsRoomJoined(false);
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
        setIsRoomJoined(true);
        if (data.calledNumbers.length > 0) {
          setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
          setShowNumber(true);
        }
      },
    });

    return () => {
      console.log('[WheelDisplay] Cleanup');
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.off('wheel:spin');
        socketRef.current.off('wheel:sync');
      }
      wsService.off();
      wsService.disconnect();
    };
  }, [gameId, handleWheelSpin, handleWheelSync]);

  // Show error if no gameId
  if (!gameId) {
    return (
      <Box
        bg="#0d0d1a"
        minH="100vh"
        minW="100vw"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack spacing={4}>
          <Text color="red.400" fontSize="2xl" fontWeight="bold">
            Missing Game ID
          </Text>
          <Text color="gray.400" fontSize="lg">
            Please use URL: /wheel?gameId=YOUR_GAME_ID
          </Text>
        </VStack>
      </Box>
    );
  }

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
          bg={isRoomJoined ? 'green.500' : isConnected ? 'yellow.500' : 'red.500'}
          boxShadow={isRoomJoined ? '0 0 10px green' : isConnected ? '0 0 10px yellow' : '0 0 10px red'}
        />
        <Text color="gray.500" fontSize="sm">
          {isRoomJoined ? 'Synced' : isConnected ? 'Connecting to game...' : 'Connecting...'}
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
            bg="linear-gradient(135deg, #E63946 0%, #B91C2C 100%)"
            borderRadius="full"
            px={{ base: 12, md: 20 }}
            py={{ base: 6, md: 10 }}
            boxShadow="0 0 60px rgba(230, 57, 70, 0.6), inset 0 0 20px rgba(255,255,255,0.1)"
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
          <Text color="#E63946" fontSize="2xl" fontWeight="bold">
            Spinning...
          </Text>
        )}
      </VStack>
    </Box>
  );
}
