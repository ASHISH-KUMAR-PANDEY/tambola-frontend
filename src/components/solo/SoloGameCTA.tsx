import { Box, Image } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { apiService, type SoloWeekResponse } from '../../services/api.service';
import { useTambolaTracking } from '../../hooks/useTambolaTracking';

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
  const isDisabled = !isConfigured && !isSunday && !userStatus.hasPlayed;

  let btnLabel = 'अभी शामिल हों';
  if (isSunday) btnLabel = 'टिकट देखो';
  else if (isCompleted) btnLabel = 'टिकट देखो';
  else if (isInProgress) btnLabel = 'जारी रखें';
  else if (!isConfigured) btnLabel = 'जल्द आ रहा है';

  const handleCTAClick = () => {
    if (isDisabled) return;
    trackEvent({
      eventName: 'solo_cta_clicked',
      properties: {
        game_mode: isCompleted ? 'completed' : isInProgress ? 'resume' : 'fresh',
        cta_label: btnLabel,
        player_count_shown: playerCount,
      },
    });
    navigate('/soloGame');
  };

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '600px' }}
      mx="auto"
      opacity={isDisabled ? 0.5 : 1}
      borderRadius="12px"
      overflow="hidden"
      position="relative"
    >
      <Image
        src="/card1.svg"
        alt="Daily Tambola"
        w="100%"
        borderRadius="12px"
        display="block"
      />
      {/* Invisible click overlay positioned exactly over the green CTA button */}
      {/* Card1: 360x340, button at y=268 h=54 x=18 w=324 */}
      <Box
        position="absolute"
        bottom="5.3%"
        left="5%"
        w="90%"
        h="15.9%"
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
        onClick={handleCTAClick}
        borderRadius="8px"
        _hover={!isDisabled ? { bg: 'rgba(255,255,255,0.08)' } : undefined}
        _active={!isDisabled ? { bg: 'rgba(0,0,0,0.08)' } : undefined}
        transition="background 0.15s ease"
      />
    </Box>
  );
}
