import { Box, Text, VStack, Center, HStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import type { RegistrationCard as RegistrationCardType } from '../services/api.service';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { useState, useEffect } from 'react';

// Helper to generate fake ticket numbers
const generateTicketStats = (cardId: string): { sold: number; left: number; lastVisit: number } => {
  const storageKey = `ticket_stats_${cardId}`;
  const stored = localStorage.getItem(storageKey);
  const now = Date.now();

  if (stored) {
    const data = JSON.parse(stored);
    const timeSinceLastVisit = now - data.lastVisit;
    const hoursPassed = timeSinceLastVisit / (1000 * 60 * 60);

    // Increase sold and decrease left based on time passed
    // More aggressive changes for longer time gaps
    const soldIncrease = Math.floor(Math.random() * 200 + 50 + hoursPassed * 30);
    const leftDecrease = Math.floor(Math.random() * 30 + 10 + hoursPassed * 5);

    const newSold = data.sold + soldIncrease;
    const newLeft = Math.max(50 + Math.floor(Math.random() * 50), data.left - leftDecrease); // Never below ~50-100

    const newData = { sold: newSold, left: newLeft, lastVisit: now };
    localStorage.setItem(storageKey, JSON.stringify(newData));
    return newData;
  } else {
    // First visit - generate initial numbers
    const initialSold = 10000 + Math.floor(Math.random() * 5000); // 10,000 - 15,000
    const initialLeft = 400 + Math.floor(Math.random() * 200); // 400 - 600
    const newData = { sold: initialSold, left: initialLeft, lastVisit: now };
    localStorage.setItem(storageKey, JSON.stringify(newData));
    return newData;
  }
};

// Format number with commas (Indian style)
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-IN');
};

// Faster pulse animation for the buzzer
const buzzerPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 30px rgba(37, 141, 88, 0.6), 0 0 60px rgba(37, 141, 88, 0.4), 0 8px 0 #1a5c3a, inset 0 -8px 20px rgba(0,0,0,0.3);
    transform: translateY(0) scale(1);
  }
  50% {
    box-shadow: 0 0 50px rgba(37, 141, 88, 0.9), 0 0 100px rgba(37, 141, 88, 0.6), 0 8px 0 #1a5c3a, inset 0 -8px 20px rgba(0,0,0,0.3);
    transform: translateY(-3px) scale(1.03);
  }
`;

const buzzerPress = keyframes`
  0% {
    transform: translateY(0);
    box-shadow: 0 8px 0 #1a5c3a, 0 0 30px rgba(37, 141, 88, 0.6);
  }
  50% {
    transform: translateY(6px);
    box-shadow: 0 2px 0 #1a5c3a, 0 0 50px rgba(37, 141, 88, 1);
  }
  100% {
    transform: translateY(0);
    box-shadow: 0 8px 0 #1a5c3a, 0 0 30px rgba(37, 141, 88, 0.6);
  }
`;

// Hand pointing animation
const handPoint = keyframes`
  0%, 100% {
    transform: translate(-50%, 0) rotate(-15deg);
  }
  50% {
    transform: translate(-50%, 10px) rotate(-15deg);
  }
`;

// Confetti animations - falling from top
const confettiFall = keyframes`
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(500px) rotate(1080deg) scale(0.5);
    opacity: 0;
  }
`;

// Confetti animations - rising from bottom
const confettiRise = keyframes`
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-500px) rotate(-1080deg) scale(0.5);
    opacity: 0;
  }
`;

const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#FF69B4', '#00FF7F', '#FF4500', '#7B68EE'];

interface RegistrationCardProps {
  card: RegistrationCardType;
  // Optional external state management
  externalReminderSet?: boolean;
  onReminderChange?: (isSet: boolean) => void;
}

export function RegistrationCard({ card, externalReminderSet, onReminderChange }: RegistrationCardProps) {
  const timeRemaining = useCountdown(card.targetDateTime);
  const countdownText = formatCountdown(timeRemaining);
  const { trackEvent } = useTambolaTracking();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Fake ticket scarcity stats
  const [ticketStats, setTicketStats] = useState<{ sold: number; left: number }>({ sold: 0, left: 0 });

  useEffect(() => {
    const stats = generateTicketStats(card.id);
    setTicketStats({ sold: stats.sold, left: stats.left });
  }, [card.id]);

  // Use internal state if no external state is provided
  const [internalReminderSet, setInternalReminderSet] = useState(() => {
    const key = `reminder_${card.id}`;
    const registeredAtStr = localStorage.getItem(key);
    if (!registeredAtStr) return false;
    const registeredAt = new Date(registeredAtStr);
    const lastResetAt = new Date(card.lastResetAt);
    return registeredAt > lastResetAt;
  });

  // Use external state if provided, otherwise use internal
  const reminderSet = externalReminderSet !== undefined ? externalReminderSet : internalReminderSet;
  const setReminderSet = (value: boolean) => {
    setInternalReminderSet(value);
    onReminderChange?.(value);
  };

  const handleBuzzerPress = () => {
    if (reminderSet) return;

    setIsPressed(true);

    // Show confetti after press animation
    setTimeout(() => {
      setShowConfetti(true);
      setReminderSet(true);

      // Track event
      const rawUserId = localStorage.getItem('app_user_id');
      const userId = rawUserId && rawUserId !== 'lobby' ? rawUserId : null;
      const playerName = sessionStorage.getItem('playerName') || 'Anonymous';

      if (userId) {
        trackEvent({
          eventName: 'registration_reminder_set',
          properties: {
            card_id: card.id,
            user_name: playerName,
            target_date_time: card.targetDateTime,
            message: card.message,
          },
        });
      }

      // Save to localStorage
      const key = `reminder_${card.id}`;
      localStorage.setItem(key, new Date().toISOString());
    }, 300);

    setTimeout(() => setIsPressed(false), 300);
  };

  // Generate confetti pieces from top (70) and bottom (50)
  const confettiFromTop = Array.from({ length: 70 }, (_, i) => ({
    id: `top-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1.5,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 6 + Math.random() * 12,
    shape: Math.random() > 0.5 ? 'full' : Math.random() > 0.5 ? 'sm' : 'none',
    fromBottom: false,
  }));

  const confettiFromBottom = Array.from({ length: 50 }, (_, i) => ({
    id: `bottom-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.5 + Math.random() * 1.5,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 6 + Math.random() * 12,
    shape: Math.random() > 0.5 ? 'full' : Math.random() > 0.5 ? 'sm' : 'none',
    fromBottom: true,
  }));

  const confettiPieces = [...confettiFromTop, ...confettiFromBottom];

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '800px', lg: '1000px' }}
      mx="auto"
      minH={{ base: '60vh', md: '65vh' }}
      py={{ base: 10, md: 12 }}
      px={{ base: 6, md: 8 }}
      bg="grey.700"
      borderRadius="lg"
      boxShadow="xl"
      border="2px"
      borderColor="brand.500"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
    >
      {/* Confetti Animation */}
      {showConfetti && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="none"
          zIndex={10}
        >
          {confettiPieces.map((piece) => (
            <Box
              key={piece.id}
              position="absolute"
              top={piece.fromBottom ? 'auto' : '-20px'}
              bottom={piece.fromBottom ? '-20px' : 'auto'}
              left={`${piece.left}%`}
              w={`${piece.size}px`}
              h={piece.shape === 'none' ? `${piece.size * 0.4}px` : `${piece.size}px`}
              bg={piece.color}
              borderRadius={piece.shape === 'none' ? '1px' : piece.shape}
              animation={`${piece.fromBottom ? confettiRise : confettiFall} ${piece.duration}s ease-out ${piece.delay}s forwards`}
            />
          ))}
        </Box>
      )}

      <VStack spacing={{ base: 8, md: 10 }} align="stretch" w="100%">
        {/* Message - Primary Focus */}
        <Text
          fontSize={{ base: '2xl', md: '4xl' }}
          fontWeight="bold"
          color="white"
          textAlign="center"
          lineHeight="1.3"
          whiteSpace="pre-line"
        >
          {card.message}
        </Text>

        {/* Countdown Timer */}
        <Box
          py={{ base: 4, md: 5 }}
          px={{ base: 4, md: 6 }}
          bg="rgba(234, 158, 4, 0.15)"
          borderRadius="lg"
          border="2px solid"
          borderColor="#ea9e04"
        >
          <Text
            fontSize={{ base: '2xl', md: '3xl' }}
            color="#ea9e04"
            fontWeight="bold"
            textAlign="center"
            letterSpacing="wide"
          >
            {timeRemaining.isExpired ? '⏱️ जल्द शुरू होगा' : countdownText}
          </Text>
        </Box>

        {/* Circular Buzzer Button with Hand Gesture */}
        <Center position="relative">
          {/* Pointing Hand Gesture - bottom right of button */}
          {!reminderSet && (
            <Box
              position="absolute"
              bottom={{ base: '-15px', md: '-20px' }}
              right={{ base: 'calc(50% - 130px)', md: 'calc(50% - 160px)' }}
              fontSize={{ base: '55px', md: '70px' }}
              animation={`${handPoint} 1s ease-in-out infinite`}
              zIndex={15}
              pointerEvents="none"
              filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))"
              transform="rotate(30deg)"
            >
              👆
            </Box>
          )}

          <Box
            as="button"
            onClick={handleBuzzerPress}
            disabled={reminderSet}
            w={{ base: '180px', md: '220px' }}
            h={{ base: '180px', md: '220px' }}
            borderRadius="full"
            bg={reminderSet
              ? 'linear-gradient(180deg, #38A169 0%, #276749 100%)'
              : 'linear-gradient(180deg, #38A169 0%, #258D58 50%, #1a6b42 100%)'
            }
            border="6px solid"
            borderColor={reminderSet ? '#276749' : '#1a5c3a'}
            cursor={reminderSet ? 'default' : 'pointer'}
            position="relative"
            animation={reminderSet || isPressed ? undefined : `${buzzerPulse} 1.2s ease-in-out infinite`}
            sx={isPressed ? {
              animation: `${buzzerPress} 0.3s ease-out`,
            } : {}}
            boxShadow={reminderSet
              ? '0 4px 0 #1a5c3a, 0 0 30px rgba(56, 161, 105, 0.5), inset 0 -5px 15px rgba(0,0,0,0.2)'
              : '0 8px 0 #1a5c3a, 0 0 30px rgba(37, 141, 88, 0.6), inset 0 -8px 20px rgba(0,0,0,0.3)'
            }
            transition="all 0.1s ease-out"
            _hover={reminderSet ? {} : {
              transform: 'scale(1.05)',
              boxShadow: '0 10px 0 #1a5c3a, 0 0 50px rgba(37, 141, 88, 0.8), inset 0 -8px 20px rgba(0,0,0,0.3)',
            }}
            _active={reminderSet ? {} : {
              transform: 'translateY(6px)',
              boxShadow: '0 2px 0 #1a5c3a, 0 0 50px rgba(37, 141, 88, 1), inset 0 -8px 20px rgba(0,0,0,0.3)',
            }}
          >
            {/* Inner circle highlight */}
            <Box
              position="absolute"
              top="15%"
              left="15%"
              right="15%"
              bottom="15%"
              borderRadius="full"
              bg="linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%)"
              pointerEvents="none"
            />

            {/* Button Text */}
            <VStack spacing={1} position="relative" zIndex={1} justify="center" h="100%">
              {reminderSet ? (
                <>
                  <Text fontSize={{ base: '5xl', md: '6xl' }} color="white">✓</Text>
                  <Text
                    fontSize={{ base: 'md', md: 'lg' }}
                    fontWeight="bold"
                    color="white"
                    textAlign="center"
                    textShadow="0 2px 4px rgba(0,0,0,0.4)"
                    px={2}
                  >
                    आप रजिस्टर्ड हैं
                  </Text>
                </>
              ) : (
                <Text
                  fontSize={{ base: '3xl', md: '4xl' }}
                  fontWeight="extrabold"
                  color="white"
                  textAlign="center"
                  textShadow="0 2px 4px rgba(0,0,0,0.4)"
                  lineHeight="1.2"
                >
                  रजिस्टर<br />करें
                </Text>
              )}
            </VStack>
          </Box>
        </Center>

        {/* Fake Ticket Scarcity Stats */}
        <VStack spacing={2} pt={4}>
          <HStack spacing={2} justify="center">
            <Text fontSize={{ base: 'lg', md: 'xl' }} color="grey.300">
              🎫
            </Text>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              color="white"
            >
              {formatNumber(ticketStats.sold)} टिकट बिक चुके
            </Text>
          </HStack>
          <HStack spacing={2} justify="center">
            <Text fontSize={{ base: 'lg', md: 'xl' }} color="orange.400">
              ⚡
            </Text>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              color="orange.400"
            >
              केवल {formatNumber(ticketStats.left)} टिकट बचे!
            </Text>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}
