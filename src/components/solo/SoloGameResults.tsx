import { Box, VStack, HStack, Text, Button, Badge, Image } from '@chakra-ui/react';
import { SoloTicket } from './SoloTicket';
import { useSoloGameStore } from '../../stores/soloGameStore';
import type { CategoryRankingsResponse } from '../../services/api.service';

const getAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

const categoryLabels: Record<string, string> = {
  EARLY_5: 'पहले पांच',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

interface SoloGameResultsProps {
  onBackToLobby: () => void;
  categoryRankings?: CategoryRankingsResponse | null;
}

export function SoloGameResults({ onBackToLobby, categoryRankings }: SoloGameResultsProps) {
  const { ticket, claims } = useSoloGameStore();

  const claimedCategories = Array.from(claims.keys());

  return (
    <VStack spacing={6} w="100%" align="stretch" py={4}>
      {/* Success message */}
      <Box bg="rgba(37, 141, 88, 0.15)" borderRadius="lg" p={5} border="1px solid" borderColor="brand.500">
        <Text color="brand.400" textAlign="center" fontWeight="bold" fontSize={{ base: 'lg', md: 'xl' }}>
          ✅ आपकी टिकट जमा हो गई है!
        </Text>
      </Box>

      {/* Completed Ticket (read-only) */}
      {ticket && (
        <Box>
          <Text fontSize="sm" color="grey.400" mb={2} textAlign="center">
            आपकी टिकट
          </Text>
          <SoloTicket ticket={ticket} readOnly compact />
        </Box>
      )}

      {/* Category Leaderboard Cards — only for claimed categories */}
      {claimedCategories.length > 0 && categoryRankings && (
        <VStack spacing={3} w="100%">
          <Text fontSize="sm" color="grey.400" textAlign="center" fontWeight="semibold">
            आपकी रैंकिंग
          </Text>
          {claimedCategories.map((category) => {
            const rank = categoryRankings.userRanks?.[category];
            const entries = categoryRankings.rankings?.[category] || [];
            const total = categoryRankings.totalClaimers?.[category] || 0;

            return (
              <Box
                key={category}
                w="100%"
                bg="grey.800"
                borderRadius="lg"
                overflow="hidden"
                border="1px solid"
                borderColor="grey.700"
              >
                {/* Card header */}
                <HStack
                  justify="space-between"
                  bg="grey.700"
                  px={4}
                  py={2.5}
                >
                  <Text fontSize="sm" fontWeight="bold" color="white">
                    {categoryLabels[category]}
                  </Text>
                  {rank && (
                    <Badge colorScheme="green" fontSize="sm" px={2} py={0.5}>
                      आप #{rank} पर हैं
                    </Badge>
                  )}
                </HStack>

                {/* Leaderboard list */}
                <VStack align="stretch" spacing={0} px={3} py={2}>
                  {entries.map((entry, idx) => {
                    const prevRank = idx > 0 ? entries[idx - 1].rank : 0;
                    const showSeparator = entry.rank - prevRank > 1;

                    return (
                      <Box key={`${category}-${entry.rank}`}>
                        {showSeparator && (
                          <Text fontSize="xs" color="grey.500" textAlign="center" py={0.5}>• • •</Text>
                        )}
                        <HStack
                          justify="center"
                          py={1.5}
                          px={3}
                          borderRadius="md"
                          bg={entry.isCurrentUser ? 'rgba(37, 141, 88, 0.2)' : 'transparent'}
                          spacing={2.5}
                        >
                          <Text
                            fontSize="xs"
                            fontWeight="bold"
                            color={entry.rank <= 3 ? 'highlight.400' : 'grey.400'}
                            minW="24px"
                            textAlign="right"
                          >
                            #{entry.rank}
                          </Text>
                          <Image
                            src={getAvatarUrl(entry.isCurrentUser ? 'me-player' : entry.userName)}
                            alt=""
                            w="22px"
                            h="22px"
                            borderRadius="full"
                            bg="grey.600"
                            flexShrink={0}
                          />
                          <Text
                            fontSize="xs"
                            fontWeight={entry.isCurrentUser ? 'bold' : 'medium'}
                            color={entry.isCurrentUser ? 'brand.400' : 'grey.300'}
                          >
                            {entry.isCurrentUser ? 'आप' : entry.userName}
                          </Text>
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              </Box>
            );
          })}
        </VStack>
      )}

      {/* Winner announcement message */}
      <Box bg="rgba(239, 167, 63, 0.15)" borderRadius="lg" p={5} border="1px solid" borderColor="highlight.500">
        <Text color="highlight.400" textAlign="center" fontWeight="semibold" fontSize={{ base: 'md', md: 'lg' }}>
          🏆 रविवार को विजेता की घोषणा होगी
        </Text>
      </Box>

      <Button
        colorScheme="brand"
        variant="outline"
        onClick={onBackToLobby}
        size={{ base: 'md', md: 'lg' }}
      >
        लॉबी पर वापस जाएं
      </Button>
    </VStack>
  );
}
