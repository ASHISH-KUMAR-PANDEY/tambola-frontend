import { Box, Text, VStack, Center } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import type { RegistrationCard as RegistrationCardType } from '../services/api.service';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { useState } from 'react';

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

// Confetti animations
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

const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#FF69B4', '#00FF7F', '#FF4500', '#7B68EE'];

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

  // Generate more confetti pieces (100 instead of 50)
  const confettiPieces = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1.5,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 6 + Math.random() * 12,
    shape: Math.random() > 0.5 ? 'full' : Math.random() > 0.5 ? 'sm' : 'none',
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
              h={piece.shape === 'none' ? `${piece.size * 0.4}px` : `${piece.size}px`}
              bg={piece.color}
              borderRadius={piece.shape === 'none' ? '1px' : piece.shape}
              animation={`${confettiFall} ${piece.duration}s ease-out ${piece.delay}s forwards`}
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
              bottom={{ base: '-10px', md: '-15px' }}
              right={{ base: 'calc(50% - 120px)', md: 'calc(50% - 150px)' }}
              fontSize={{ base: '45px', md: '55px' }}
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
                  <Text fontSize={{ base: '4xl', md: '5xl' }} color="white">✓</Text>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight="bold"
                    color="white"
                    textAlign="center"
                    textShadow="0 2px 4px rgba(0,0,0,0.4)"
                    px={4}
                  >
                    रजिस्टर्ड!
                  </Text>
                </>
              ) : (
                <Text
                  fontSize={{ base: '2xl', md: '3xl' }}
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
      </VStack>
    </Box>
  );
}
