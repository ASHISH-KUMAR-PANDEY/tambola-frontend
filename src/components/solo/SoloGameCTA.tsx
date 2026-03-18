import { Box, Text, HStack, Flex } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { apiService, type SoloWeekResponse } from '../../services/api.service';
import { useTambolaTracking } from '../../hooks/useTambolaTracking';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(239, 167, 63, 0.25); }
  50% { box-shadow: 0 0 45px rgba(239, 167, 63, 0.5); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
`;

/** Generate a fake-ish "live" player count that looks realistic */
function generatePlayerCount(realCount: number): number {
  const base = Math.max(200, realCount * 12);
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const pseudoRandom = ((daySeed * 9301 + 49297) % 233280) / 233280;
  const jitter = Math.floor(pseudoRandom * 150) + 50;
  return base + jitter;
}

export function SoloGameCTA() {
  const navigate = useNavigate();
  const { trackEvent } = useTambolaTracking();
  const [data, setData] = useState<SoloWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await apiService.getSoloCurrentWeek();
        setData(result);
      } catch (error) {
        console.error('Failed to load solo week:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Countdown timer — loops every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const playerCount = useMemo(() => {
    if (!data) return 0;
    return generatePlayerCount(data.stats?.playerCount || 0);
  }, [data]);

  if (loading || !data) return null;

  const { userStatus, flags } = data;
  const isCompleted = userStatus.gameStatus === 'COMPLETED';
  const isInProgress = userStatus.gameStatus === 'IN_PROGRESS';
  const isSunday = flags.isSunday;
  const isConfigured = data.week.isConfigured !== false;
  const hasPlayed = userStatus.hasPlayed;

  // --- State-driven config ---
  let label = 'जल्दी Join करें';
  let subtitle = 'रोज़ खेलो, रोज़ जीतो!';
  let accentFrom = '#F6B93B';
  let accentTo = '#E58E26';
  let btnTextColor = '#111';
  let shouldPulse = true;
  let showPlayerCount = true;
  let showTimer = true;

  if (isSunday) {
    label = 'टिकट देखो';
    subtitle = 'आज Sunday है — आराम करो!';
    accentFrom = '#555';
    accentTo = '#333';
    btnTextColor = '#ddd';
    shouldPulse = false;
    showPlayerCount = false;
    showTimer = false;
  } else if (isCompleted) {
    label = 'टिकट देखो';
    subtitle = 'आज का game खेल लिया! ✅';
    accentFrom = '#555';
    accentTo = '#333';
    btnTextColor = '#ddd';
    shouldPulse = false;
    showTimer = false;
  } else if (isInProgress) {
    label = 'जारी रखें';
    subtitle = 'Game अभी चल रहा है!';
    accentFrom = '#27AE60';
    accentTo = '#1E8449';
    btnTextColor = '#fff';
  } else if (!isConfigured) {
    label = 'जल्द आ रहा है';
    subtitle = 'नया game तैयार हो रहा है...';
    accentFrom = '#555';
    accentTo = '#333';
    btnTextColor = '#ddd';
    shouldPulse = false;
    showPlayerCount = false;
    showTimer = false;
  }

  const isDisabled = !isConfigured && !isSunday && !hasPlayed;

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '800px', lg: '1000px' }}
      mx="auto"
      cursor={isDisabled ? 'not-allowed' : 'pointer'}
      onClick={() => {
        if (isDisabled) return;
        trackEvent({
          eventName: 'solo_cta_clicked',
          properties: {
            game_mode: isCompleted ? 'completed' : isInProgress ? 'resume' : 'fresh',
            cta_label: label,
            player_count_shown: playerCount,
          },
        });
        navigate('/soloGame');
      }}
      animation={shouldPulse ? `${pulseGlow} 3s ease-in-out infinite` : undefined}
      borderRadius="2xl"
      overflow="hidden"
      border="2px solid"
      borderColor={accentFrom}
      opacity={isDisabled ? 0.5 : 1}
      _hover={!isDisabled ? { transform: 'scale(1.015)', transition: 'all 0.25s ease' } : undefined}
      _active={!isDisabled ? { transform: 'scale(0.98)' } : undefined}
      transition="all 0.25s ease"
      position="relative"
    >
      {/* Main card */}
      <Box
        bg="#111"
        position="relative"
        overflow="hidden"
        py={{ base: 10, md: 12 }}
        px={{ base: 5, md: 8 }}
        minH={{ base: '300px', md: '340px' }}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        {/* Accent gradient border at top */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="4px"
          bgGradient={`linear(to-r, ${accentFrom}, ${accentTo}, ${accentFrom})`}
        />

        {/* Subtle radial glow behind content */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w="120%"
          h="120%"
          bg={`radial-gradient(ellipse at center, ${accentFrom}12 0%, transparent 70%)`}
          pointerEvents="none"
        />

        {/* Title */}
        <Text
          fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }}
          fontWeight="extrabold"
          color="white"
          letterSpacing="wider"
          position="relative"
          zIndex={1}
          animation={shouldPulse ? `${float} 4s ease-in-out infinite` : undefined}
        >
          LIVE TAMBOLA
        </Text>

        {/* Accent line under title */}
        <Box
          w="60px"
          h="3px"
          bgGradient={`linear(to-r, ${accentFrom}, ${accentTo})`}
          borderRadius="full"
          mt={2}
          mb={3}
        />

        {/* Subtitle */}
        <Text
          fontSize={{ base: 'md', md: 'lg' }}
          fontWeight="medium"
          color="whiteAlpha.700"
          letterSpacing="wide"
          position="relative"
          zIndex={1}
        >
          {subtitle}
        </Text>

        {/* Timer + Player count — single row */}
        {(showTimer || showPlayerCount) && (
          <Flex
            justify="center"
            align="center"
            gap={{ base: 3, md: 5 }}
            mt={{ base: 5, md: 6 }}
            flexWrap="wrap"
            position="relative"
            zIndex={1}
          >
            {showTimer && (
              <HStack spacing={1.5}>
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg={countdown <= 5 ? '#E74C3C' : accentFrom}
                  animation={`${pulse} ${countdown <= 5 ? '0.5s' : '2s'} ease-in-out infinite`}
                />
                <Text
                  fontSize={{ base: 'xs', md: 'sm' }}
                  fontWeight="semibold"
                  color="whiteAlpha.600"
                  fontFamily="mono"
                >
                  शुरू होने में 0:{countdown.toString().padStart(2, '0')}
                </Text>
              </HStack>
            )}

            {showTimer && showPlayerCount && (
              <Box w="1px" h="14px" bg="whiteAlpha.200" />
            )}

            {showPlayerCount && playerCount > 0 && (
              <HStack spacing={1.5}>
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg="#E74C3C"
                  animation={`${pulse} 1.5s ease-in-out infinite`}
                />
                <Text
                  fontSize={{ base: 'xs', md: 'sm' }}
                  fontWeight="semibold"
                  color="whiteAlpha.600"
                >
                  {playerCount.toLocaleString('en-IN')}+ खेल रहे हैं
                </Text>
              </HStack>
            )}
          </Flex>
        )}

        {/* CTA Button */}
        <Box
          mt={{ base: 6, md: 8 }}
          w={{ base: '80%', md: '60%' }}
          position="relative"
          zIndex={1}
        >
          <Box
            py={{ base: 3.5, md: 4 }}
            px={{ base: 6, md: 10 }}
            borderRadius="xl"
            textAlign="center"
            css={{
              background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
            }}
            _hover={{
              opacity: 0.9,
            }}
            transition="all 0.2s ease"
          >
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="extrabold"
              color={btnTextColor}
              letterSpacing="wider"
              textTransform="uppercase"
            >
              {label}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
