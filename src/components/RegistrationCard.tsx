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

    // Show confetti after press
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
      minH={{ base: '45vh', md: '50vh' }}
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

        {/* Register Button */}
        <Center>
          <Box
            as="button"
            onClick={handleBuzzerPress}
            disabled={reminderSet}
            w={{ base: '85%', md: '70%' }}
            py={{ base: 4, md: 5 }}
            px={8}
            borderRadius="xl"
            bg={reminderSet ? 'brand.700' : 'brand.500'}
            cursor={reminderSet ? 'default' : 'pointer'}
            transition="all 0.2s ease"
            _hover={reminderSet ? {} : {
              bg: 'brand.600',
            }}
            _active={reminderSet ? {} : {
              bg: 'brand.700',
              transform: 'scale(0.98)',
            }}
          >
            <Text
              fontSize={{ base: 'xl', md: '2xl' }}
              fontWeight="extrabold"
              color="white"
              textAlign="center"
              letterSpacing="wide"
            >
              {reminderSet ? '✓ आप रजिस्टर्ड हैं' : 'रजिस्टर करें'}
            </Text>
          </Box>
        </Center>

        {/* Fake Ticket Scarcity Stats */}
        <VStack spacing={2} pt={4}>
          <HStack spacing={2} justify="center">
            <Text fontSize={{ base: 'lg', md: 'xl' }} color="orange.400">
              ⚡
            </Text>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              color="white"
            >
              केवल <Text as="span" color="yellow.400">{formatNumber(ticketStats.left)}</Text> टिकट बचे हैं
            </Text>
          </HStack>
          <HStack spacing={2} justify="center">
            <Text fontSize={{ base: 'lg', md: 'xl' }} color="grey.300">
              🎫
            </Text>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              color="grey.400"
            >
              {formatNumber(ticketStats.sold)} टिकट बुक हो चुके हैं
            </Text>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}
