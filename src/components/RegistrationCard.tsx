import { Box, Button, Text, VStack, HStack } from '@chakra-ui/react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { RegistrationCard as RegistrationCardType } from '../services/api.service';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { useState } from 'react';

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
      p={{ base: 6, md: 8 }}
      bg="grey.700"
      borderRadius="lg"
      boxShadow="xl"
      border="2px"
      borderColor="brand.500"
    >
      <VStack spacing={{ base: 4, md: 5 }} align="stretch">
        {/* Message - Primary Focus with multi-line support */}
        <Text
          fontSize={{ base: '2xl', md: '3xl' }}
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
          py={3}
          px={4}
          bg="rgba(234, 158, 4, 0.15)"
          borderRadius="md"
          border="2px solid"
          borderColor="#ea9e04"
        >
          <Text
            fontSize={{ base: 'xl', md: '2xl' }}
            color="#ea9e04"
            fontWeight="bold"
            textAlign="center"
            letterSpacing="wide"
          >
            {timeRemaining.isExpired ? '⏱️ जल्द शुरू होगा' : countdownText}
          </Text>
        </Box>

        {/* Set Reminder Button - Updated text */}
        <Button
          bg={reminderSet ? 'green.600' : 'brand.500'}
          color="white"
          size={{ base: 'md', md: 'lg' }}
          onClick={handleSetReminder}
          isDisabled={reminderSet}
          w="100%"
          fontWeight="bold"
          leftIcon={reminderSet ? <Text>✓</Text> : undefined}
          _disabled={{
            bg: 'green.600',
            color: 'white',
            opacity: 1,
            cursor: 'not-allowed'
          }}
          _hover={reminderSet ? {
            bg: 'green.600'
          } : {
            bg: 'brand.600'
          }}
        >
          {reminderSet ? 'आप रजिस्टर्ड हैं' : 'इस Sunday के लिए रजिस्टर करें'}
        </Button>
      </VStack>
    </Box>
  );
}
