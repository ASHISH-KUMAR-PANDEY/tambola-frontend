import { Box, Text, VStack, Center } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import type { RegistrationCard as RegistrationCardType } from '../services/api.service';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { useState } from 'react';

// Pulse animation for the buzzer
const buzzerPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 30px rgba(37, 141, 88, 0.6), 0 0 60px rgba(37, 141, 88, 0.4), 0 8px 0 #1a5c3a, inset 0 -8px 20px rgba(0,0,0,0.3);
    transform: translateY(0);
  }
  50% {
    box-shadow: 0 0 50px rgba(37, 141, 88, 0.8), 0 0 100px rgba(37, 141, 88, 0.5), 0 8px 0 #1a5c3a, inset 0 -8px 20px rgba(0,0,0,0.3);
    transform: translateY(-2px);
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

// Confetti animations
const confettiFall = keyframes`
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(400px) rotate(720deg);
    opacity: 0;
  }
`;

const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];

interface RegistrationCardProps {
  card: RegistrationCardType;
}

export function RegistrationCard({ card }: RegistrationCardProps) {
  const timeRemaining = useCountdown(card.targetDateTime);
  const countdownText = formatCountdown(timeRemaining);
  const { trackEvent } = useTambolaTracking();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [reminderSet, setReminderSet] = useState(() => {
    const key = `reminder_${card.id}`;
    const registeredAtStr = localStorage.getItem(key);
    if (!registeredAtStr) return false;
    const registeredAt = new Date(registeredAtStr);
    const lastResetAt = new Date(card.lastResetAt);
    return registeredAt > lastResetAt;
  });

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

  // Generate confetti pieces
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 8 + Math.random() * 8,
  }));

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '800px', lg: '1000px' }}
      mx="auto"
      minH={{ base: '75vh', md: '80vh' }}
      p={{ base: 6, md: 8 }}
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
              top="-20px"
              left={`${piece.left}%`}
              w={`${piece.size}px`}
              h={`${piece.size}px`}
              bg={piece.color}
              borderRadius={Math.random() > 0.5 ? 'full' : 'sm'}
              animation={`${confettiFall} ${piece.duration}s ease-out ${piece.delay}s forwards`}
            />
          ))}
        </Box>
      )}

      <VStack spacing={{ base: 6, md: 8 }} align="stretch" w="100%">
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

        {/* Spacer for more gap */}
        <Box h={{ base: 4, md: 6 }} />

        {/* Circular Buzzer Button */}
        <Center>
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
            animation={reminderSet || isPressed ? undefined : `${buzzerPulse} 2s ease-in-out infinite`}
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
            <VStack spacing={1} position="relative" zIndex={1}>
              {reminderSet ? (
                <>
                  <Text fontSize={{ base: '3xl', md: '4xl' }} color="white">✓</Text>
                  <Text
                    fontSize={{ base: 'md', md: 'lg' }}
                    fontWeight="bold"
                    color="white"
                    textAlign="center"
                    textShadow="0 2px 4px rgba(0,0,0,0.4)"
                    px={4}
                  >
                    आप रजिस्टर्ड हैं
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight="bold"
                    color="white"
                    textAlign="center"
                    textShadow="0 2px 4px rgba(0,0,0,0.4)"
                    px={4}
                    lineHeight="1.2"
                  >
                    इस Sunday के लिए
                  </Text>
                  <Text
                    fontSize={{ base: 'xl', md: '2xl' }}
                    fontWeight="extrabold"
                    color="white"
                    textAlign="center"
                    textShadow="0 2px 4px rgba(0,0,0,0.4)"
                  >
                    रजिस्टर करें
                  </Text>
                </>
              )}
            </VStack>
          </Box>
        </Center>
      </VStack>
    </Box>
  );
}
