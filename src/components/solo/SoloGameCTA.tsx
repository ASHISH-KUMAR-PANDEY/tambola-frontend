import { Box, Button, Text, HStack } from '@chakra-ui/react';
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

  // Determine button label, gradient, and pulse
  let label = 'अभी खेलो';
  let bgGradient = 'linear(to-r, highlight.500, highlight.700)';
  let hoverBg = 'linear(to-r, highlight.600, highlight.800)';
  let shouldPulse = true;

  if (isSunday) {
    label = 'टिकट देखो';
    bgGradient = 'linear(to-r, grey.600, grey.700)';
    hoverBg = 'linear(to-r, grey.500, grey.600)';
    shouldPulse = false;
  } else if (isCompleted) {
    label = 'टिकट देखो';
    bgGradient = 'linear(to-r, grey.600, grey.700)';
    hoverBg = 'linear(to-r, grey.500, grey.600)';
    shouldPulse = false;
  } else if (isInProgress) {
    label = 'जारी रखो';
    bgGradient = 'linear(to-r, brand.500, brand.700)';
    hoverBg = 'linear(to-r, brand.600, brand.800)';
  } else if (!isConfigured) {
    label = 'जल्द आ रहा है';
    bgGradient = 'linear(to-r, grey.600, grey.700)';
    hoverBg = 'linear(to-r, grey.500, grey.600)';
    shouldPulse = false;
  }

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '800px', lg: '1000px' }}
      mx="auto"
    >
      <Button
        w="100%"
        h={{ base: '58px', md: '62px' }}
        bgGradient={bgGradient}
        color="white"
        fontSize={{ base: 'md', md: 'lg' }}
        fontWeight="bold"
        borderRadius="xl"
        border="1px solid"
        borderColor="whiteAlpha.200"
        onClick={() => navigate('/soloGame')}
        isDisabled={!isConfigured && !isSunday && !hasPlayed}
        animation={shouldPulse ? `${pulseGlow} 3s ease-in-out infinite` : undefined}
        _hover={{ bgGradient: hoverBg }}
        _active={{ bgGradient: hoverBg, transform: 'scale(0.98)' }}
      >
        <HStack spacing={3}>
          <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="extrabold">
            🎯 Daily TAMBOLA
          </Text>
          <Text
            fontSize={{ base: 'sm', md: 'md' }}
            fontWeight="medium"
            opacity={0.9}
          >
            — {label}
          </Text>
        </HStack>
      </Button>
    </Box>
  );
}
