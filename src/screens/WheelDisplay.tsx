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
  0%, 100% { text-shadow: 0 0 20px rgba(230, 57, 70, 0.5), 0 0 40px rgba(230, 57, 70, 0.3); }
  50% { text-shadow: 0 0 40px rgba(230, 57, 70, 0.8), 0 0 80px rgba(230, 57, 70, 0.5); }
`;

const SPIN_DURATION = 3000;

export default function WheelDisplay() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');

  const [remainingNumbers, setRemainingNumbers] = useState<number[]>(
    Array.from({ length: 90 }, (_, i) => i + 1)
  );
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [wheelSize, setWheelSize] = useState(600);

  const socketRef = useRef<any>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpinningRef = useRef(false);
  const gameIdRef = useRef(gameId);

  // Keep refs in sync with state
  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

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

    // Handle wheel spin trigger - defined here to use refs for stable closure
    const handleWheelSpinTrigger = (data: { gameId: string; remainingNumbers: number[] }) => {
      console.log('[WheelDisplay] Received wheel:spin trigger', data);

      if (isSpinningRef.current) {
        console.log('[WheelDisplay] Already spinning, ignoring');
        return;
      }

      // Clear any existing timeout
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }

      const numbers = data.remainingNumbers;
      if (!numbers || numbers.length === 0) {
        console.log('[WheelDisplay] No numbers to spin');
        return;
      }

      // THIS wheel picks the random number
      const randomIndex = Math.floor(Math.random() * numbers.length);
      const selectedNumber = numbers[randomIndex];

      console.log('[WheelDisplay] Selected number:', selectedNumber);

      // Update state and start spinning
      setRemainingNumbers(numbers);
      setTargetNumber(selectedNumber);
      setIsSpinning(true);
      setShowNumber(false);

      // After spin completes, emit result back to organizer
      spinTimeoutRef.current = setTimeout(() => {
        setIsSpinning(false);
        setLastCalledNumber(selectedNumber);
        setShowNumber(true);

        // Remove the number from remaining
        setRemainingNumbers(prev => prev.filter(n => n !== selectedNumber));

        // Emit result back to game room (organizer will receive this)
        console.log('[WheelDisplay] Emitting wheel:result', selectedNumber);
        const socket = socketRef.current;
        const currentGameId = gameIdRef.current;
        if (socket && currentGameId) {
          socket.emit('wheel:result', { gameId: currentGameId, number: selectedNumber });
        } else {
          console.error('[WheelDisplay] Cannot emit result - socket or gameId missing', { socket: !!socket, gameId: currentGameId });
        }
      }, SPIN_DURATION);
    };

    // Handle wheel sync event
    const handleWheelSync = (data: { calledNumbers: number[]; remainingNumbers: number[] }) => {
      console.log('[WheelDisplay] Received wheel:sync', data);
      setRemainingNumbers(data.remainingNumbers);
      if (data.calledNumbers.length > 0) {
        setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
        setShowNumber(true);
      }
      setIsRoomJoined(true);
    };

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
          socket.on('wheel:spin', handleWheelSpinTrigger);
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
        // Update remaining numbers when a number is called
        setRemainingNumbers(prev => prev.filter(n => n !== data.number));
        setLastCalledNumber(data.number);
        setShowNumber(true);
      },
      onStateSync: (data) => {
        console.log('[WheelDisplay] Received state sync', data);
        const remaining = Array.from({ length: 90 }, (_, i) => i + 1).filter(
          (n) => !data.calledNumbers.includes(n)
        );
        setRemainingNumbers(remaining);
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
  }, [gameId]); // Only depend on gameId - handlers use refs for other state

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
          {isRoomJoined ? 'Ready' : isConnected ? 'Connecting to game...' : 'Connecting...'}
        </Text>
      </Box>

      <VStack spacing={6}>
        {/* Wheel */}
        <Box position="relative">
          <SpinWheel
            numbers={remainingNumbers}
            isSpinning={isSpinning}
            targetNumber={targetNumber}
            size={wheelSize}
            spinDuration={SPIN_DURATION}
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
