import { Box, Text, HStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiService, type SoloWeekResponse } from '../../services/api.service';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(239, 167, 63, 0.3); }
  50% { box-shadow: 0 0 40px rgba(239, 167, 63, 0.6); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
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
  const [data, setData] = useState<SoloWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);

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

  // Countdown timer — loops every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
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

  let label = 'जल्दी Join करें';
  let subtitle = 'रोज़ खेलो, रोज़ जीतो! 🏆';
  let description = 'हर दिन नया ticket, नया मौका — अपना नंबर आने दो और claim मारो!';
  let cardBgGradient = 'linear(to-br, highlight.400, highlight.600)';
  let btnBg = 'highlight.700';
  let btnHoverBg = 'highlight.800';
  let shouldPulse = true;
  let showPlayerCount = true;
  let showTimer = true;

  if (isSunday) {
    label = 'टिकट देखो';
    subtitle = 'आज Sunday है — आराम करो! 😴';
    description = 'कल से फिर नया game शुरू होगा, तब तक अपना ticket check करो।';
    cardBgGradient = 'linear(to-br, grey.500, grey.700)';
    btnBg = 'grey.700';
    btnHoverBg = 'grey.800';
    shouldPulse = false;
    showPlayerCount = false;
    showTimer = false;
  } else if (isCompleted) {
    label = 'टिकट देखो';
    subtitle = 'आज का game खेल लिया! ✅';
    description = 'शाबाश! कल फिर नया ticket मिलेगा — daily खेलो, ranking बढ़ाओ!';
    cardBgGradient = 'linear(to-br, grey.500, grey.700)';
    btnBg = 'grey.700';
    btnHoverBg = 'grey.800';
    shouldPulse = false;
    showTimer = false;
  } else if (isInProgress) {
    label = 'जारी रखें ▶';
    subtitle = 'Game अभी चल रहा है! 🔥';
    description = 'आपका ticket wait कर रहा है — वापस आओ और claim मारो!';
    cardBgGradient = 'linear(to-br, brand.400, brand.600)';
    btnBg = 'brand.700';
    btnHoverBg = 'brand.800';
  } else if (!isConfigured) {
    label = 'जल्द आ रहा है';
    subtitle = 'नया game तैयार हो रहा है ⏳';
    description = 'थोड़ा wait करो — आज का game जल्द ही शुरू होगा!';
    cardBgGradient = 'linear(to-br, grey.500, grey.700)';
    btnBg = 'grey.700';
    btnHoverBg = 'grey.800';
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
      onClick={() => !isDisabled && navigate('/soloGame')}
      animation={shouldPulse ? `${pulseGlow} 3s ease-in-out infinite` : undefined}
      borderRadius="2xl"
      overflow="hidden"
      border="2px solid"
      borderColor="whiteAlpha.300"
      opacity={isDisabled ? 0.5 : 1}
      _hover={!isDisabled ? { transform: 'scale(1.01)', transition: 'transform 0.2s' } : undefined}
      _active={!isDisabled ? { transform: 'scale(0.97)' } : undefined}
      transition="transform 0.2s"
    >
      {/* Main card area */}
      <Box
        bgGradient={cardBgGradient}
        py={{ base: 8, md: 10 }}
        px={{ base: 5, md: 8 }}
        textAlign="center"
        position="relative"
        minH={{ base: '280px', md: '320px' }}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        {/* Title */}
        <Text
          fontSize={{ base: '2xl', md: '3xl', lg: '4xl' }}
          fontWeight="extrabold"
          color="white"
          letterSpacing="wider"
          textShadow="0 2px 8px rgba(0,0,0,0.3)"
        >
          🎯 DAILY TAMBOLA
        </Text>

        {/* Subtitle */}
        <Text
          fontSize={{ base: 'lg', md: 'xl' }}
          fontWeight="bold"
          color="whiteAlpha.900"
          mt={{ base: 2, md: 3 }}
        >
          {subtitle}
        </Text>

        {/* Description */}
        <Text
          fontSize={{ base: 'sm', md: 'md' }}
          color="whiteAlpha.800"
          mt={{ base: 2, md: 3 }}
          maxW="500px"
          mx="auto"
          lineHeight="tall"
        >
          {description}
        </Text>

        {/* Countdown timer */}
        {showTimer && (
          <HStack
            justify="center"
            mt={{ base: 3, md: 4 }}
            spacing={2}
          >
            <Box
              bg="rgba(0,0,0,0.3)"
              backdropFilter="blur(4px)"
              px={4}
              py={1.5}
              borderRadius="full"
            >
              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                fontWeight="bold"
                color="white"
                animation={countdown <= 3 ? `${blink} 0.5s ease-in-out infinite` : undefined}
              >
                ⏰ Game शुरू होने वाला है — 0:{countdown.toString().padStart(2, '0')}
              </Text>
            </Box>
          </HStack>
        )}

        {/* Player count badge */}
        {showPlayerCount && playerCount > 0 && (
          <HStack
            justify="center"
            mt={{ base: 2, md: 3 }}
            spacing={2}
          >
            <Box
              bg="whiteAlpha.200"
              backdropFilter="blur(4px)"
              px={4}
              py={1.5}
              borderRadius="full"
            >
              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                fontWeight="semibold"
                color="white"
              >
                🔴 {playerCount.toLocaleString('en-IN')}+ लोग खेल रहे हैं
              </Text>
            </Box>
          </HStack>
        )}

        {/* CTA Button */}
        <Box mt={{ base: 5, md: 6 }} w="100%">
          <Box
            bg={btnBg}
            py={{ base: 3.5, md: 4 }}
            px={{ base: 8, md: 10 }}
            borderRadius="xl"
            display="inline-block"
            w={{ base: '85%', md: '70%' }}
            _hover={{ bg: btnHoverBg }}
            boxShadow="0 4px 15px rgba(0,0,0,0.3)"
            css={shouldPulse ? {
              backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: `${shimmer} 3s linear infinite`,
            } : undefined}
          >
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="extrabold"
              color="white"
              letterSpacing="wide"
            >
              {label}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
