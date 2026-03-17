import { Box, Button } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiService, type SoloWeekResponse } from '../../services/api.service';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 15px rgba(37, 141, 88, 0.3); }
  50% { box-shadow: 0 0 30px rgba(37, 141, 88, 0.6); }
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

  // Determine button label and style
  let label = 'अभी खेलो — Daily TAMBOLA';
  let colorScheme = 'brand';
  let shouldPulse = true;

  if (isSunday) {
    label = 'टिकट देखो — Daily TAMBOLA';
    shouldPulse = false;
  } else if (isCompleted) {
    label = 'टिकट देखो — Daily TAMBOLA';
    shouldPulse = false;
  } else if (isInProgress) {
    label = 'जारी रखो — Daily TAMBOLA';
    colorScheme = 'highlight';
  } else if (!isConfigured) {
    label = 'जल्द आ रहा है — Daily TAMBOLA';
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
        h={{ base: '52px', md: '56px' }}
        colorScheme={colorScheme}
        fontSize={{ base: 'md', md: 'lg' }}
        fontWeight="bold"
        borderRadius="lg"
        onClick={() => navigate('/soloGame')}
        isDisabled={!isConfigured && !isSunday && !hasPlayed}
        animation={shouldPulse ? `${pulseGlow} 3s ease-in-out infinite` : undefined}
      >
        {label}
      </Button>
    </Box>
  );
}
