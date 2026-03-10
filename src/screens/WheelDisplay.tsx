import { Box, Text, VStack, Spinner } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import SpinWheel from '../components/SpinWheel';
import { wsService } from '../services/websocket.service';

// Pulse animation for the called number
const pulseKeyframes = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.9; }
`;

// Glow animation for the number display
const glowKeyframes = keyframes`
  0%, 100% { text-shadow: 0 0 20px rgba(37, 141, 88, 0.5), 0 0 40px rgba(37, 141, 88, 0.3); }
  50% { text-shadow: 0 0 40px rgba(37, 141, 88, 0.8), 0 0 80px rgba(37, 141, 88, 0.5); }
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
    setTargetNumber(data.targetNumber);
    setIsSpinning(true);
    setShowNumber(false);

    // Show number after spin completes
    setTimeout(() => {
      setIsSpinning(false);
      setLastCalledNumber(data.targetNumber);
      setShowNumber(true);
    }, data.spinDuration);
  }, []);

  // Handle number called event
  const handleNumberCalled = useCallback((data: { number: number }) => {
    console.log('[WheelDisplay] Received game:numberCalled', data);
    setCalledNumbers((prev) => {
      if (prev.includes(data.number)) return prev;
      return [...prev, data.number];
    });
    setLastCalledNumber(data.number);
    setShowNumber(true);
  }, []);

  // Handle wheel sync event
  const handleWheelSync = useCallback((data: { calledNumbers: number[]; remainingNumbers: number[] }) => {
    console.log('[WheelDisplay] Received wheel:sync', data);
    setCalledNumbers(data.calledNumbers);
    if (data.calledNumbers.length > 0) {
      setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
      setShowNumber(true);
    }
  }, []);

  // Connect to WebSocket and setup listeners
  useEffect(() => {
    // Connect with a special wheel-display user ID
    const wheelUserId = `wheel-display-${Date.now()}`;
    wsService.connect(wheelUserId);

    // Setup event handlers
    wsService.on({
      onConnected: () => {
        console.log('[WheelDisplay] Connected to WebSocket');
        setIsConnected(true);

        // Request sync if we have a gameId
        if (gameId) {
          console.log('[WheelDisplay] Requesting wheel sync for game:', gameId);
          wsService.requestWheelSync(gameId);
        }
      },
      onDisconnected: () => {
        console.log('[WheelDisplay] Disconnected from WebSocket');
        setIsConnected(false);
      },
      onNumberCalled: handleNumberCalled,
      onStateSync: (data) => {
        console.log('[WheelDisplay] Received state sync', data);
        setCalledNumbers(data.calledNumbers);
        if (data.calledNumbers.length > 0) {
          setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
          setShowNumber(true);
        }
      },
    });

    // Setup wheel-specific listeners directly on socket
    const socket = (wsService as any).socket;
    if (socket) {
      socket.on('wheel:spin', handleWheelSpin);
      socket.on('wheel:sync', handleWheelSync);
    }

    // If gameId provided, join the game room
    if (gameId) {
      wsService.joinGame(gameId, 'Wheel Display');
    }

    return () => {
      if (socket) {
        socket.off('wheel:spin', handleWheelSpin);
        socket.off('wheel:sync', handleWheelSync);
      }
      wsService.off();
      wsService.disconnect();
    };
  }, [gameId, handleWheelSpin, handleNumberCalled, handleWheelSync]);

  return (
    <Box
      bg="gray.900"
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
        />
        <Text color="gray.500" fontSize="sm">
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </Box>

      {/* Called numbers count */}
      <Box
        position="absolute"
        top={4}
        left={4}
      >
        <Text color="gray.500" fontSize="sm">
          Called: {calledNumbers.length} / 90
        </Text>
      </Box>

      <VStack spacing={8}>
        {/* Wheel */}
        <Box position="relative">
          <SpinWheel
            numbers={remainingNumbers}
            isSpinning={isSpinning}
            targetNumber={targetNumber}
            size={Math.min(window.innerWidth * 0.7, window.innerHeight * 0.6, 600)}
            spinDuration={3000}
            disabled={true}
          />

          {/* Spinning indicator */}
          {isSpinning && (
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
            >
              <Spinner size="xl" color="white" thickness="4px" />
            </Box>
          )}
        </Box>

        {/* Last called number display */}
        {showNumber && lastCalledNumber && (
          <Box
            animation={`${pulseKeyframes} 2s ease-in-out infinite`}
            bg="brand.500"
            borderRadius="full"
            px={16}
            py={8}
            boxShadow="0 0 60px rgba(37, 141, 88, 0.6)"
          >
            <Text
              fontSize={{ base: '80px', md: '120px', lg: '150px' }}
              fontWeight="bold"
              color="white"
              animation={`${glowKeyframes} 2s ease-in-out infinite`}
              textAlign="center"
              lineHeight="1"
            >
              {lastCalledNumber}
            </Text>
          </Box>
        )}

        {/* Waiting state */}
        {!showNumber && !isSpinning && (
          <Text color="gray.400" fontSize="2xl">
            Waiting for spin...
          </Text>
        )}

        {/* Game ID display */}
        {gameId && (
          <Text color="gray.600" fontSize="sm">
            Game: {gameId.substring(0, 8)}...
          </Text>
        )}
      </VStack>
    </Box>
  );
}
