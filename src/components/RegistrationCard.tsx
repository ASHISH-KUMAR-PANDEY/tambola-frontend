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

    console.log('[RegistrationCard] handleSetReminder called');
    console.log('[RegistrationCard] URL:', window.location.href);
    console.log('[RegistrationCard] userId from URL:', userId);
    console.log('[RegistrationCard] userId type:', typeof userId);
    console.log('[RegistrationCard] userId is valid?:', userId && userId !== 'lobby');

    // Get player name from sessionStorage
    const playerName = sessionStorage.getItem('playerName') || 'Anonymous';
    console.log('[RegistrationCard] playerName:', playerName);

    // Track event in RudderStack only if userId is valid (not "lobby")
    if (userId && userId !== 'lobby') {
      console.log('[RegistrationCard] Tracking event registration_reminder_set');
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
      console.log('[RegistrationCard] Event tracked successfully');
    } else {
      console.warn('[RegistrationCard] Event NOT tracked - userId invalid:', userId);
    }

    // Mark reminder as set
    setReminderSet(true);
    const key = `reminder_${card.id}`;
    localStorage.setItem(key, 'true');
    console.log('[RegistrationCard] Reminder marked as set in localStorage');
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
        {/* Message - Primary Focus (White with proper hierarchy) */}
        <Text
          fontSize={{ base: '2xl', md: '3xl' }}
          fontWeight="bold"
          color="white"
          textAlign="center"
          lineHeight="1.3"
        >
          {card.message}
        </Text>

        {/* Countdown Timer - Subtle highlight with golden accent */}
        <Box
          py={2}
          borderBottom="2px solid"
          borderColor="#ea9e04"
        >
          <HStack justify="center" spacing={2}>
            {!timeRemaining.isExpired && (
              <Text fontSize={{ base: 'sm', md: 'md' }} color="#b6b6b6">
                ⏱️ Time remaining:
              </Text>
            )}
            <Text fontSize={{ base: 'sm', md: 'md' }} color="#ea9e04" fontWeight="semibold">
              {timeRemaining.isExpired ? '⏱️ जल्द शुरू होगा' : countdownText}
            </Text>
          </HStack>
        </Box>

        {/* Set Reminder Button - Clean state management */}
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
          {reminderSet ? 'रिमाइंडर सेट किया' : 'रिमाइंडर सेट करें'}
        </Button>
      </VStack>
    </Box>
  );
}
