import { Box, VStack, HStack, Text, Button, Image } from '@chakra-ui/react';
import { SoloTicket } from './SoloTicket';
import { useSoloGameStore } from '../../stores/soloGameStore';
import type { CategoryRankingsResponse } from '../../services/api.service';

const getAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

const fakeNames = ['Ravi', 'Sunita', 'Mohit', 'Kavita', 'Deepak', 'Meena', 'Suresh', 'Pooja', 'Arun', 'Sapna', 'Vikas', 'Rekha'];

function arrangeEntries(entries: any[]): any[] {
  const named = entries.filter((e: any) => e.userName !== 'Anonymous' || e.isCurrentUser);
  const currentUser = named.find((e: any) => e.isCurrentUser);
  let others = named.filter((e: any) => !e.isCurrentUser);
  const needed = (currentUser ? 8 : 9) - others.length;
  if (needed > 0) {
    const used = new Set(others.map((e: any) => e.userName));
    const padding = fakeNames
      .filter(n => !used.has(n))
      .slice(0, needed)
      .map(n => ({ rank: 0, userName: n, numberCountAtClaim: 0, isCurrentUser: false }));
    others = [...others, ...padding];
  }
  others = others.slice(0, currentUser ? 8 : 9);
  if (!currentUser) return others;
  const pos = Math.min(4, others.length);
  return [...others.slice(0, pos), currentUser, ...others.slice(pos)].slice(0, 9);
}

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
            const entries = categoryRankings.rankings?.[category] || [];

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
                </HStack>

                {/* Player bubbles */}
                <HStack spacing={2} flexWrap="wrap" justify="center" gap={2} px={3} py={3}>
                  {arrangeEntries(entries).map((entry) => (
                    <HStack
                      key={`${category}-${entry.rank}`}
                      spacing={1.5}
                      bg={entry.isCurrentUser ? 'rgba(37, 141, 88, 0.25)' : 'rgba(255,255,255,0.05)'}
                      border="1px solid"
                      borderColor={entry.isCurrentUser ? 'brand.500' : 'grey.600'}
                      borderRadius="full"
                      px={2.5}
                      py={1}
                    >
                      <Image
                        src={getAvatarUrl(entry.isCurrentUser ? 'me-player' : entry.userName)}
                        alt=""
                        w="20px"
                        h="20px"
                        borderRadius="full"
                        bg="grey.600"
                        flexShrink={0}
                      />
                      <Text
                        fontSize="2xs"
                        fontWeight={entry.isCurrentUser ? 'bold' : 'medium'}
                        color={entry.isCurrentUser ? 'brand.400' : 'grey.300'}
                      >
                        {entry.isCurrentUser ? 'आप' : entry.userName}
                      </Text>
                    </HStack>
                  ))}
                  {(() => {
                    const real = categoryRankings?.totalClaimers?.[category] || 0;
                    const seed = category.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                    const jitter = (seed * 9301 + 49297) % 50;
                    const boosted = Math.max(real * 12, 200) + jitter;
                    return (
                      <HStack
                        spacing={1}
                        bg="rgba(255,255,255,0.05)"
                        borderRadius="full"
                        px={2.5}
                        py={1}
                      >
                        <Text fontSize="2xs" fontWeight="semibold" color="grey.500">
                          <Text as="span" color="brand.400" fontWeight="bold">+{boosted}</Text> और खिलाड़ी
                        </Text>
                      </HStack>
                    );
                  })()}
                </HStack>
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
