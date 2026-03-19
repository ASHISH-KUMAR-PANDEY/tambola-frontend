import { Box, Image, Text, HStack, VStack } from '@chakra-ui/react';
import type { RegistrationCard as RegistrationCardType } from '../services/api.service';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { useCountdown } from '../hooks/useCountdown';
import { useState } from 'react';

interface RegistrationCardProps {
  card: RegistrationCardType;
  externalReminderSet?: boolean;
  onReminderChange?: (isSet: boolean) => void;
}

export function RegistrationCard({ card, externalReminderSet, onReminderChange }: RegistrationCardProps) {
  const { trackEvent } = useTambolaTracking();
  const timeRemaining = useCountdown(card.targetDateTime);

  const [internalReminderSet, setInternalReminderSet] = useState(() => {
    const key = `reminder_${card.id}`;
    const registeredAtStr = localStorage.getItem(key);
    if (!registeredAtStr) return false;
    const registeredAt = new Date(registeredAtStr);
    const lastResetAt = new Date(card.lastResetAt);
    return registeredAt > lastResetAt;
  });

  const reminderSet = externalReminderSet !== undefined ? externalReminderSet : internalReminderSet;
  const setReminderSet = (value: boolean) => {
    setInternalReminderSet(value);
    onReminderChange?.(value);
  };

  const handleRegister = () => {
    if (reminderSet) return;
    setReminderSet(true);
    const rawUserId = localStorage.getItem('app_user_id');
    const userId = rawUserId && rawUserId !== 'lobby' ? rawUserId : null;
    const playerName = sessionStorage.getItem('playerName') || 'Anonymous';
    if (userId) {
      trackEvent({
        eventName: 'registration_reminder_set',
        properties: { card_id: card.id, user_name: playerName, target_date_time: card.targetDateTime, message: card.message },
      });
    }
    const key = `reminder_${card.id}`;
    localStorage.setItem(key, new Date().toISOString());
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '600px' }}
      mx="auto"
      borderRadius="12px"
      overflow="hidden"
      position="relative"
    >
      <Image
        src="/card2.svg"
        alt="Sunday Tambola"
        w="100%"
        borderRadius="12px"
        display="block"
      />

      {/* Dynamic countdown overlay — covers the static countdown baked in the SVG */}
      {/* SVG is 360x301. Countdown area: right of orange button, ~x=218 to x=350, y=229 to y=283 */}
      <Box
        position="absolute"
        bottom="6%"
        right="2.8%"
        w="36.5%"
        h="17.9%"
        bg="white"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {timeRemaining.isExpired ? (
          <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="#333">
            जल्द शुरू होगा
          </Text>
        ) : (
          <HStack spacing={{ base: 0.5, md: 1 }} align="center">
            {[
              { val: timeRemaining.days, label: 'दिन' },
              { val: timeRemaining.hours, label: 'घंटे' },
              { val: timeRemaining.minutes, label: 'मिनट' },
              { val: timeRemaining.seconds, label: 'सेकंड' },
            ].map((item, i) => (
              <HStack key={item.label} spacing={0} align="center">
                {i > 0 && (
                  <Text
                    fontSize={{ base: 'md', md: 'xl' }}
                    fontWeight="bold"
                    color="#1a1a1a"
                    mx={{ base: '1px', md: 1 }}
                    lineHeight="1"
                  >
                    :
                  </Text>
                )}
                <VStack spacing={0}>
                  <Text
                    fontSize={{ base: 'md', md: 'xl' }}
                    fontWeight="800"
                    color="#1a1a1a"
                    lineHeight="1.2"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {pad(item.val)}
                  </Text>
                  <Text
                    fontSize={{ base: '5px', md: '7px' }}
                    color="#999"
                    lineHeight="1"
                    fontWeight="500"
                  >
                    {item.label}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </HStack>
        )}
      </Box>

      {/* CTA button overlay — positioned over the orange button in the SVG */}
      {/* SVG orange button: x=18, y=229, w=190, h=54 within 360x301 */}
      <Box
        position="absolute"
        bottom="6%"
        left="5%"
        w="52.8%"
        h="17.9%"
        cursor={reminderSet ? 'default' : 'pointer'}
        data-testid="registration-cta"
        onClick={handleRegister}
        borderRadius="8px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg={reminderSet ? '#3a3a3a' : 'transparent'}
        _hover={!reminderSet ? { bg: 'rgba(255,255,255,0.1)' } : undefined}
        _active={!reminderSet ? { bg: 'rgba(0,0,0,0.1)' } : undefined}
        transition="all 0.2s ease"
      >
        {reminderSet && (
          <Text
            fontSize={{ base: 'xs', md: 'sm' }}
            fontWeight="bold"
            color="white"
          >
            ✓ रजिस्टर्ड
          </Text>
        )}
      </Box>
    </Box>
  );
}
