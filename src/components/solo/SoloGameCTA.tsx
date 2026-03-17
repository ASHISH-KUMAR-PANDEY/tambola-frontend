import { Box, Text, VStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiService, type SoloWeekResponse } from '../../services/api.service';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 15px rgba(239, 167, 63, 0.3); }
  50% { box-shadow: 0 0 30px rgba(239, 167, 63, 0.6); }
`;

export function SoloGameCTA() {
  const navigate = useNavigate();
  const [data, setData] = useState<SoloWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !data) return null;

  const { userStatus, flags } = data;
  const isCompleted = userStatus.gameStatus === 'COMPLETED';
  const isInProgress = userStatus.gameStatus === 'IN_PROGRESS';
  const isSunday = flags.isSunday;
  const isConfigured = data.week.isConfigured !== false;
  const hasPlayed = userStatus.hasPlayed;

  let label = 'अभी खेलें';
  let cardBg = 'highlight.500';
  let btnBg = 'highlight.700';
  let btnHoverBg = 'highlight.800';
  let shouldPulse = true;

  if (isSunday) {
    label = 'टिकट देखो';
    cardBg = 'grey.600';
    btnBg = 'grey.700';
    btnHoverBg = 'grey.800';
    shouldPulse = false;
  } else if (isCompleted) {
    label = 'टिकट देखो';
    cardBg = 'grey.600';
    btnBg = 'grey.700';
    btnHoverBg = 'grey.800';
    shouldPulse = false;
  } else if (isInProgress) {
    label = 'जारी रखें';
    cardBg = 'brand.500';
    btnBg = 'brand.700';
    btnHoverBg = 'brand.800';
  } else if (!isConfigured) {
    label = 'जल्द आ रहा है';
    cardBg = 'grey.600';
    btnBg = 'grey.700';
    btnHoverBg = 'grey.800';
    shouldPulse = false;
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
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="whiteAlpha.200"
      opacity={isDisabled ? 0.5 : 1}
      _hover={!isDisabled ? { transform: 'scale(1.01)', transition: 'transform 0.2s' } : undefined}
      _active={!isDisabled ? { transform: 'scale(0.98)' } : undefined}
      transition="transform 0.2s"
    >
      {/* Top: Orange card with title */}
      <Box
        bg={cardBg}
        py={{ base: 3, md: 4 }}
        px={4}
        textAlign="center"
      >
        <Text
          fontSize={{ base: 'xl', md: '2xl' }}
          fontWeight="extrabold"
          color="white"
          letterSpacing="wide"
        >
          🎯 DAILY TAMBOLA
        </Text>
      </Box>

      {/* Bottom: Darker button strip */}
      <Box
        bg={btnBg}
        py={{ base: 2.5, md: 3 }}
        px={4}
        textAlign="center"
        _groupHover={{ bg: btnHoverBg }}
      >
        <Text
          fontSize={{ base: 'md', md: 'lg' }}
          fontWeight="bold"
          color="white"
        >
          {label}
        </Text>
      </Box>
    </Box>
  );
}
