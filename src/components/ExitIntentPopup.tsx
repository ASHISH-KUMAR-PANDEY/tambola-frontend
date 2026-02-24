import { Box, Text, VStack, Center, IconButton } from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { keyframes } from '@emotion/react';
import { useState, useEffect } from 'react';
import { useTambolaTracking } from '../hooks/useTambolaTracking';

// Buzzer pulse animation
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

// Confetti animations
const confettiFall = keyframes`
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(400px) rotate(1080deg) scale(0.5);
    opacity: 0;
  }
`;

const confettiRise = keyframes`
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-400px) rotate(-1080deg) scale(0.5);
    opacity: 0;
  }
`;

// Slide in animation
const slideIn = keyframes`
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#FF69B4', '#00FF7F', '#FF4500', '#7B68EE'];

interface ExitIntentPopupProps {
  isOpen: boolean;
  cardId: string;
  onClose: () => void;
  onRegister: () => void;
}

export function ExitIntentPopup({ isOpen, cardId, onClose, onRegister }: ExitIntentPopupProps) {
  const { trackEvent } = useTambolaTracking();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(false);
      setIsPressed(false);
      setIsRegistered(false);
    }
  }, [isOpen]);

  const handleRegisterClick = () => {
    if (isRegistered) return;

    setIsPressed(true);

    setTimeout(() => {
      setShowConfetti(true);
      setIsRegistered(true);

      // Track event
      const rawUserId = localStorage.getItem('app_user_id');
      const userId = rawUserId && rawUserId !== 'lobby' ? rawUserId : null;
      const playerName = localStorage.getItem('playerName') || 'Anonymous';

      if (userId) {
        trackEvent({
          eventName: 'registration_reminder_set',
          properties: {
            card_id: cardId,
            user_name: playerName,
            source: 'exit_intent_popup',
          },
        });
      }

      // Save to localStorage
      const key = `reminder_${cardId}`;
      localStorage.setItem(key, new Date().toISOString());

      // Notify parent
      onRegister();

      // Auto close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 300);

    setTimeout(() => setIsPressed(false), 300);
  };

  // Generate confetti pieces
  const confettiFromTop = Array.from({ length: 50 }, (_, i) => ({
    id: `top-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.2 + Math.random() * 1,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 6 + Math.random() * 10,
    shape: Math.random() > 0.5 ? 'full' : Math.random() > 0.5 ? 'sm' : 'none',
    fromBottom: false,
  }));

  const confettiFromBottom = Array.from({ length: 30 }, (_, i) => ({
    id: `bottom-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.2 + Math.random() * 1,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 6 + Math.random() * 10,
    shape: Math.random() > 0.5 ? 'full' : Math.random() > 0.5 ? 'sm' : 'none',
    fromBottom: true,
  }));

  const confettiPieces = [...confettiFromTop, ...confettiFromBottom];

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="blackAlpha.800"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        position="relative"
        w="100%"
        maxW="400px"
        bg="grey.800"
        borderRadius="xl"
        boxShadow="0 0 40px rgba(37, 141, 88, 0.4)"
        border="2px solid"
        borderColor="brand.500"
        overflow="hidden"
        animation={`${slideIn} 0.3s ease-out`}
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
                top={piece.fromBottom ? 'auto' : '-10px'}
                bottom={piece.fromBottom ? '-10px' : 'auto'}
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

        {/* Close Button */}
        <IconButton
          aria-label="Close"
          icon={<CloseIcon />}
          position="absolute"
          top={3}
          right={3}
          size="sm"
          variant="ghost"
          color="grey.400"
          _hover={{ color: 'white', bg: 'grey.700' }}
          onClick={onClose}
          zIndex={20}
        />

        <VStack spacing={6} p={8} pt={12}>
          {isRegistered ? (
            // Success State
            <>
              <Text fontSize="6xl">✓</Text>
              <Text
                fontSize="xl"
                fontWeight="bold"
                color="brand.400"
                textAlign="center"
              >
                आप registered हैं
              </Text>
            </>
          ) : (
            // Initial State
            <>
              <Text
                fontSize={{ base: 'lg', md: 'xl' }}
                fontWeight="bold"
                color="white"
                textAlign="center"
                lineHeight="1.4"
              >
                अरे आपने इस Sunday Tambola खेलने के लिए register नहीं किया?
              </Text>

              {/* Register Button */}
              <Center>
                <Box
                  as="button"
                  onClick={handleRegisterClick}
                  w={{ base: '140px', md: '160px' }}
                  h={{ base: '140px', md: '160px' }}
                  borderRadius="full"
                  bg="linear-gradient(180deg, #38A169 0%, #258D58 50%, #1a6b42 100%)"
                  border="5px solid"
                  borderColor="#1a5c3a"
                  cursor="pointer"
                  position="relative"
                  animation={isPressed ? undefined : `${buzzerPulse} 1.2s ease-in-out infinite`}
                  sx={isPressed ? {
                    animation: `${buzzerPress} 0.3s ease-out`,
                  } : {}}
                  boxShadow="0 8px 0 #1a5c3a, 0 0 30px rgba(37, 141, 88, 0.6), inset 0 -8px 20px rgba(0,0,0,0.3)"
                  transition="all 0.1s ease-out"
                  _hover={{
                    transform: 'scale(1.05)',
                    boxShadow: '0 10px 0 #1a5c3a, 0 0 50px rgba(37, 141, 88, 0.8), inset 0 -8px 20px rgba(0,0,0,0.3)',
                  }}
                  _active={{
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
                  <VStack spacing={0} position="relative" zIndex={1} justify="center" h="100%">
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
                  </VStack>
                </Box>
              </Center>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
