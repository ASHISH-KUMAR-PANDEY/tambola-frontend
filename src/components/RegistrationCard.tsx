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
    // Check if reminder was already set in localStorage
    const key = `reminder_${card.id}`;
    return localStorage.getItem(key) === 'true';
  });

  const handleSetReminder = () => {
    if (reminderSet) return; // Already set, do nothing

    // Get userId from URL query params
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('app_user_id') || params.get('userId');

    // Get player name from sessionStorage
    const playerName = sessionStorage.getItem('playerName') || 'Anonymous';

    // Track event in RudderStack
    trackEvent({
      eventName: 'registration_reminder_set',
      properties: {
        card_id: card.id,
        user_id: userId,
        player_name: playerName,
        target_date_time: card.targetDateTime,
        message: card.message,
        timestamp: new Date().toISOString(),
      },
    });

    // Mark reminder as set
    setReminderSet(true);
    const key = `reminder_${card.id}`;
    localStorage.setItem(key, 'true');
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
      <VStack spacing={{ base: 4, md: 6 }} align="stretch">
        {/* Message */}
        <Text
          fontSize={{ base: 'lg', md: 'xl' }}
          fontWeight="bold"
          color="white"
          textAlign="center"
        >
          {card.message}
        </Text>

        {/* Countdown Timer */}
        <Box
          p={4}
          bg={timeRemaining.isExpired ? 'orange.500' : 'brand.500'}
          borderRadius="md"
          textAlign="center"
        >
          <HStack justify="center" spacing={2}>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold" color="white">
              ⏱️
            </Text>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold" color="white">
              {timeRemaining.isExpired ? 'Time has passed!' : `Time remaining: ${countdownText}`}
            </Text>
          </HStack>
        </Box>

        {/* Set Reminder Button */}
        <Button
          colorScheme={reminderSet ? 'green' : 'brand'}
          size={{ base: 'md', md: 'lg' }}
          onClick={handleSetReminder}
          isDisabled={reminderSet}
          w="100%"
        >
          {reminderSet ? 'Reminder Set ✓' : 'Set Reminder'}
        </Button>
      </VStack>
    </Box>
  );
}
