import { Box, VStack, HStack, Text, Button, Icon, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { apiService, type SoloWeekResponse } from '../../services/api.service';
import { useTambolaTracking } from '../../hooks/useTambolaTracking';

// ─── Card Config ─────────────────────────────────────────────
// Edit these values to change card appearance without touching JSX

const CARD_CONFIG = {
  // Top badge (set showBadge to true to enable)
  showBadge: true,
  badgeText: 'Live Now',
  badgeColor: '#22c55e', // green dot color

  // Title & subtitle
  title: 'Live Tambola',
  subtitle: 'रोज खेलो, रोज जीतो!',

  // Player count
  playerCountSuffix: 'खेल रहे हैं',

  // CTA labels per state
  ctaLabels: {
    fresh: 'अभी शामिल हों',
    inProgress: 'जारी रखें',
    completed: 'अभी खेलो',
    sunday: 'अभी खेलो',
    notConfigured: 'जल्द आ रहा है',
  },

  // Colors
  badgeBg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
  badgeTextColor: '#15803d',
  cardBg: 'white',
  cardBorder: '#e5e7eb',
  titleColor: '#1a1a1a',
  subtitleColor: '#9ca3af',
  accentLine: '#2563eb', // blue line under subtitle
  playerCountColor: '#1a1a1a',
  playerIconColor: '#f97316', // orange
  ctaBg: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #22c55e 100%)',
  ctaTextColor: 'white',

  // Route
  route: '/soloGame',
};

// ─── Helpers ─────────────────────────────────────────────────

function generatePlayerCount(realCount: number): number {
  const base = Math.max(200, realCount * 12);
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const pseudoRandom = ((daySeed * 9301 + 49297) % 233280) / 233280;
  const jitter = Math.floor(pseudoRandom * 150) + 50;
  return base + jitter;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-IN') + '+';
}

// People icon as inline SVG
function PeopleIcon(props: any) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
      />
    </Icon>
  );
}

// ─── Component ───────────────────────────────────────────────

export function SoloGameCTA({ hasMultiplayerGame = false }: { hasMultiplayerGame?: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { trackEvent } = useTambolaTracking();
  const [data, setData] = useState<SoloWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const c = CARD_CONFIG;

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

  let btnLabel = c.ctaLabels.fresh;
  if (isSunday) btnLabel = c.ctaLabels.sunday;
  else if (isCompleted) btnLabel = c.ctaLabels.completed;
  else if (isInProgress) btnLabel = c.ctaLabels.inProgress;
  else if (!isConfigured) btnLabel = c.ctaLabels.notConfigured;

  const handleCTAClick = () => {
    if (isDisabled) return;
    if (hasMultiplayerGame) {
      toast({
        title: '🎉 Sunday Tambola चल रहा है!',
        description: 'वो join करो और जीतो बड़े इनाम!',
        status: 'info',
        duration: 4000,
        isClosable: true,
        position: 'top',
      });
      trackEvent({
        eventName: 'solo_cta_blocked_by_multiplayer',
        properties: { cta_label: btnLabel },
      });
      return;
    }
    trackEvent({
      eventName: 'solo_cta_clicked',
      properties: {
        game_mode: isCompleted ? 'completed' : isInProgress ? 'resume' : 'fresh',
        cta_label: btnLabel,
        player_count_shown: playerCount,
      },
    });
    navigate(c.route);
  };

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '600px' }}
      mx="auto"
      opacity={isDisabled ? 0.5 : 1}
      borderRadius="12px"
      overflow="hidden"
      border="1px solid"
      borderColor={c.cardBorder}
      bg={c.cardBg}
    >
      {/* Badge bar — toggle via CARD_CONFIG.showBadge */}
      {c.showBadge && (
        <HStack
          justify="center"
          spacing={2}
          py={2}
          bg={c.badgeBg}
        >
          <Box w="8px" h="8px" borderRadius="full" bg={c.badgeColor} />
          <Text fontSize="sm" fontWeight="bold" color={c.badgeTextColor}>
            {c.badgeText}
          </Text>
        </HStack>
      )}

      {/* Card body */}
      <VStack spacing={1} py={5} px={4}>
        {/* Title */}
        <Text
          fontSize={{ base: '2xl', md: '3xl' }}
          fontWeight="900"
          color={c.titleColor}
          textAlign="center"
          lineHeight="1.2"
        >
          {c.title}
        </Text>

        {/* Subtitle */}
        <Text
          fontSize={{ base: 'sm', md: 'md' }}
          color={c.subtitleColor}
          textAlign="center"
        >
          {c.subtitle}
        </Text>

        {/* Accent line */}
        <Box w="28px" h="3px" bg={c.accentLine} borderRadius="full" my={1} />

        {/* Player count */}
        <HStack spacing={2} pt={2}>
          <PeopleIcon boxSize={5} color={c.playerIconColor} />
          <Text fontSize="md" fontWeight="bold" color={c.playerCountColor}>
            {formatCount(playerCount)}{' '}
            <Text as="span" fontWeight="medium" color={c.subtitleColor}>
              {c.playerCountSuffix}
            </Text>
          </Text>
        </HStack>
      </VStack>

      {/* CTA Button */}
      <Box px={4} pb={4}>
        <Button
          w="100%"
          size="lg"
          h="52px"
          fontSize="lg"
          fontWeight="bold"
          color={hasMultiplayerGame ? '#9ca3af' : c.ctaTextColor}
          bg={hasMultiplayerGame ? '#e5e7eb' : c.ctaBg}
          borderRadius="10px"
          _hover={{ opacity: hasMultiplayerGame ? 1 : 0.9 }}
          _active={{ opacity: hasMultiplayerGame ? 1 : 0.8 }}
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
          onClick={handleCTAClick}
        >
          {btnLabel}
        </Button>
      </Box>
    </Box>
  );
}
