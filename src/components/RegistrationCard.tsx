import { Box, Button, Text, VStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import type { RegistrationCard as RegistrationCardType } from '../services/api.service';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { useState } from 'react';

// Pulse animation for the CTA button
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(37, 141, 88, 0.6), 0 0 40px rgba(37, 141, 88, 0.4), 0 0 60px rgba(37, 141, 88, 0.2);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 30px rgba(37, 141, 88, 0.8), 0 0 60px rgba(37, 141, 88, 0.6), 0 0 90px rgba(37, 141, 88, 0.4);
    transform: scale(1.02);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`;

interface RegistrationCardProps {
  card: RegistrationCardType;
}

export function RegistrationCard({ card }: RegistrationCardProps) {
  const timeRemaining = useCountdown(card.targetDateTime);
  const countdownText = formatCountdown(timeRemaining);
  const { trackEvent } = useTambolaTracking();
  const [reminderSet, setReminderSet] = useState(() => {
    // Check if reminder was already set AND if it's still valid (not reset by admin)
    const key = `reminder_${card.id}`;
    const registeredAtStr = localStorage.getItem(key);

    if (!registeredAtStr) return false;

    // Compare user's registration timestamp with card's lastResetAt
    const registeredAt = new Date(registeredAtStr);
    const lastResetAt = new Date(card.lastResetAt);

    // If admin reset after user registered, show register button again
    return registeredAt > lastResetAt;
  });

  const handleSetReminder = () => {
    if (reminderSet) return; // Already set, do nothing

    // Get userId from localStorage (stored by AutoLogin after initial auth)
    const rawUserId = localStorage.getItem('app_user_id');
    const userId = rawUserId && rawUserId !== 'lobby' ? rawUserId : null;

    // Get player name from sessionStorage
    const playerName = sessionStorage.getItem('playerName') || 'Anonymous';

    // Track event in RudderStack only if userId is valid
    if (userId) {
      trackEvent({
        eventName: 'registration_reminder_set',
        properties: {
          card_id: card.id,
          user_name: playerName,
          target_date_time: card.targetDateTime,
          message: card.message,
          // user_id, timestamp, app_user_id, device_id, platform are auto-added by useTambolaTracking
        },
      });
    }

    // Mark reminder as set with current timestamp
    setReminderSet(true);
    const key = `reminder_${card.id}`;
    const now = new Date().toISOString();
    localStorage.setItem(key, now);
  };

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '800px', lg: '1000px' }}
      mx="auto"
      minH={{ base: '45vh', md: '50vh' }}
      p={{ base: 6, md: 8 }}
      bg="grey.700"
      borderRadius="lg"
      boxShadow="xl"
      border="2px"
      borderColor="brand.500"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <VStack spacing={{ base: 5, md: 6 }} align="stretch" w="100%">
        {/* Message - Primary Focus with multi-line support */}
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

        {/* Countdown Timer - Prominent and highlighted */}
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

        {/* Set Reminder Button - Glamorous CTA */}
        <Button
          bg={reminderSet ? 'green.600' : 'linear-gradient(135deg, #258D58 0%, #1a6b42 50%, #258D58 100%)'}
          color="white"
          size="lg"
          onClick={handleSetReminder}
          isDisabled={reminderSet}
          w="100%"
          h={{ base: '60px', md: '70px' }}
          fontWeight="bold"
          fontSize={{ base: 'lg', md: 'xl' }}
          leftIcon={reminderSet ? <Text fontSize="xl">✓</Text> : undefined}
          animation={reminderSet ? undefined : `${pulseGlow} 2s ease-in-out infinite`}
          position="relative"
          overflow="hidden"
          borderRadius="xl"
          textShadow="0 2px 4px rgba(0,0,0,0.3)"
          _before={reminderSet ? undefined : {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 2s linear infinite`,
          }}
          _disabled={{
            bg: 'green.600',
            color: 'white',
            opacity: 1,
            cursor: 'default',
            animation: 'none',
            boxShadow: '0 0 15px rgba(56, 161, 105, 0.5)',
          }}
          _hover={reminderSet ? {
            bg: 'green.600'
          } : {
            bg: 'linear-gradient(135deg, #2da366 0%, #1f7a4a 50%, #2da366 100%)',
            transform: 'scale(1.03)',
          }}
          _active={{
            transform: 'scale(0.98)',
          }}
          transition="all 0.2s ease-out"
        >
          {reminderSet ? 'आप रजिस्टर्ड हैं' : 'इस Sunday के लिए रजिस्टर करें'}
        </Button>
      </VStack>
    </Box>
  );
}
