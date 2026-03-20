import { Box, VStack, HStack, Text, Heading, Badge, Spinner, Center, Button } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { apiService, type SoloLeaderboardResponse, type SoloLeaderboardEntry } from '../../services/api.service';

const categoryLabels: Record<string, string> = {
  EARLY_5: 'पहले 5',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

const allCategories = ['EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE'];

interface LeaderboardSectionProps {
  data: SoloLeaderboardResponse;
  gameLabel?: string;
}

function LeaderboardSection({ data, gameLabel }: LeaderboardSectionProps) {
  const isFinalized = data.week.status === 'FINALIZED';
  const leaderboardMap = new Map<string, SoloLeaderboardEntry>();
  data.leaderboard.forEach(entry => leaderboardMap.set(entry.category, entry));

  return (
    <Box
      w="100%"
      maxW={{ base: '100%', md: '500px' }}
      mx="auto"
      bg="grey.800"
      borderRadius="lg"
      border="1px solid"
      borderColor="grey.700"
      overflow="hidden"
    >
      <Box bg={gameLabel === 'टिकट 2' ? 'purple.600' : 'brand.500'} py={3} px={4}>
        <HStack justify="center" spacing={2}>
          <Heading size="sm" color="white" textAlign="center">
            {isFinalized ? 'इस हफ्ते के विजेता' : 'लाइव लीडरबोर्ड'}
          </Heading>
          {gameLabel && (
            <Badge colorScheme={gameLabel === 'टिकट 2' ? 'purple' : 'green'} fontSize="2xs">
              {gameLabel}
            </Badge>
          )}
        </HStack>
        {data.playerCount !== undefined && (
          <Text fontSize="xs" color="whiteAlpha.800" textAlign="center" mt={1}>
            {data.playerCount} खिलाड़ी
          </Text>
        )}
      </Box>

      <VStack spacing={0} divider={<Box borderBottom="1px solid" borderColor="grey.700" w="100%" />}>
        {allCategories.map(cat => {
          const entry = leaderboardMap.get(cat);
          return (
            <HStack key={cat} w="100%" px={4} py={3} justify="space-between">
              <VStack align="start" spacing={0}>
                <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="semibold" color="white">
                  {categoryLabels[cat]}
                </Text>
                {entry ? (
                  <Text fontSize="xs" color="grey.400">
                    {entry.userName || 'Anonymous'}
                  </Text>
                ) : (
                  <Text fontSize="xs" color="grey.500">-</Text>
                )}
              </VStack>
              {entry ? (
                <Badge colorScheme={isFinalized ? 'green' : 'yellow'} fontSize={{ base: 'xs', md: 'sm' }}>
                  {entry.numberCountAtClaim} नंबर में
                </Badge>
              ) : (
                <Badge colorScheme="gray" fontSize="xs">अभी तक नहीं</Badge>
              )}
            </HStack>
          );
        })}
      </VStack>

      {!isFinalized && (
        <Box px={4} py={2} bg="grey.900">
          <Text fontSize="2xs" color="grey.500" textAlign="center">
            अंतिम नतीजे रविवार को
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface SoloLeaderboardProps {
  weekId?: string;
  /** When provided, only show this game's leaderboard (used in results screen). When omitted, show both with tabs (Sunday view). */
  gameNumber?: number;
}

export function SoloLeaderboard({ weekId, gameNumber }: SoloLeaderboardProps) {
  const [game1Data, setGame1Data] = useState<SoloLeaderboardResponse | null>(null);
  const [game2Data, setGame2Data] = useState<SoloLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  useEffect(() => {
    const load = async () => {
      try {
        if (gameNumber) {
          // Single game mode — only fetch the specified game
          const data = await apiService.getSoloLeaderboard(weekId, gameNumber);
          if (gameNumber === 2) {
            setGame2Data(data);
          } else {
            setGame1Data(data);
          }
        } else {
          // Dual game mode (Sunday view) — fetch both
          const [g1, g2] = await Promise.all([
            apiService.getSoloLeaderboard(weekId, 1),
            apiService.getSoloLeaderboard(weekId, 2).catch(() => null),
          ]);
          setGame1Data(g1);
          if (g2 && g2.leaderboard && g2.leaderboard.length > 0) {
            setGame2Data(g2);
          }
        }
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [weekId, gameNumber]);

  if (loading) {
    return <Center py={4}><Spinner size="md" color="brand.500" /></Center>;
  }

  // Single game mode
  if (gameNumber) {
    const data = gameNumber === 2 ? game2Data : game1Data;
    if (!data) {
      return <Text color="grey.400" textAlign="center">लीडरबोर्ड लोड नहीं हो सका</Text>;
    }
    return <LeaderboardSection data={data} />;
  }

  // Dual game mode (Sunday view)
  if (!game1Data) {
    return <Text color="grey.400" textAlign="center">लीडरबोर्ड लोड नहीं हो सका</Text>;
  }

  // If no Game 2 data, show single leaderboard
  if (!game2Data) {
    return <LeaderboardSection data={game1Data} />;
  }

  // Dual-game leaderboard with tab toggle
  return (
    <VStack spacing={4} w="100%">
      {/* Tab toggle */}
      <HStack spacing={2} w="100%" justify="center">
        <Button
          size="sm"
          variant={activeTab === 1 ? 'solid' : 'outline'}
          colorScheme="brand"
          onClick={() => setActiveTab(1)}
          fontWeight="bold"
        >
          टिकट 1
        </Button>
        <Button
          size="sm"
          variant={activeTab === 2 ? 'solid' : 'outline'}
          colorScheme="purple"
          onClick={() => setActiveTab(2)}
          fontWeight="bold"
        >
          टिकट 2
        </Button>
      </HStack>

      {/* Show active tab leaderboard */}
      {activeTab === 1 && <LeaderboardSection data={game1Data} gameLabel="टिकट 1" />}
      {activeTab === 2 && <LeaderboardSection data={game2Data} gameLabel="टिकट 2" />}
    </VStack>
  );
}
