import { Box, VStack, HStack, Text, Heading, Badge, Spinner, Center } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { apiService, type SoloLeaderboardResponse, type SoloLeaderboardEntry } from '../../services/api.service';

const categoryLabels: Record<string, string> = {
  EARLY_5: 'पहले 5',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

interface SoloLeaderboardProps {
  weekId?: string;
}

export function SoloLeaderboard({ weekId }: SoloLeaderboardProps) {
  const [data, setData] = useState<SoloLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await apiService.getSoloLeaderboard(weekId);
        setData(result);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [weekId]);

  if (loading) {
    return <Center py={4}><Spinner size="md" color="brand.500" /></Center>;
  }

  if (!data) {
    return <Text color="grey.400" textAlign="center">लीडरबोर्ड लोड नहीं हो सका</Text>;
  }

  const isFinalized = data.week.status === 'FINALIZED';
  const allCategories = ['EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE'];
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
      <Box bg="brand.500" py={3} px={4}>
        <Heading size="sm" color="white" textAlign="center">
          {isFinalized ? 'इस हफ्ते के विजेता' : 'लाइव लीडरबोर्ड'}
        </Heading>
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
