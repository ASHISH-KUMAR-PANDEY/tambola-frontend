import { Box, HStack, Button, VStack, Text, Badge, Image } from '@chakra-ui/react';
import { useState } from 'react';
import { useSoloGameStore, type WinCategory } from '../../stores/soloGameStore';
import type { CategoryRankingsResponse } from '../../services/api.service';

const getAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

interface SoloClaimButtonsProps {
  onClaim: (category: WinCategory) => void;
  isClaimLoading: WinCategory | null;
  categoryRankings?: CategoryRankingsResponse | null;
}

const categories: { key: WinCategory; label: string; lineIndex?: number }[] = [
  { key: 'EARLY_5', label: 'पहले पांच' },
  { key: 'TOP_LINE', label: 'ऊपर वाली लाइन', lineIndex: 0 },
  { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन', lineIndex: 1 },
  { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन', lineIndex: 2 },
  { key: 'FULL_HOUSE', label: 'सारे नंबर' },
];

export function SoloClaimButtons({ onClaim, isClaimLoading, categoryRankings }: SoloClaimButtonsProps) {
  const { claims, checkEarly5, checkLineComplete, checkFullHouse } = useSoloGameStore();
  const [expandedCategory, setExpandedCategory] = useState<WinCategory | null>(null);

  const isPatternComplete = (category: WinCategory, _lineIndex?: number): boolean => {
    switch (category) {
      case 'EARLY_5': return checkEarly5();
      case 'TOP_LINE': return checkLineComplete(0);
      case 'MIDDLE_LINE': return checkLineComplete(1);
      case 'BOTTOM_LINE': return checkLineComplete(2);
      case 'FULL_HOUSE': return checkFullHouse();
      default: return false;
    }
  };

  const userRank = (key: WinCategory): number | null => {
    return categoryRankings?.userRanks?.[key] ?? null;
  };

  const totalForCategory = (key: WinCategory): number => {
    return categoryRankings?.totalClaimers?.[key] ?? 0;
  };

  return (
    <Box w="100%" maxW={{ base: '100%', md: '500px' }} mx="auto">
      <Text fontSize={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center" fontWeight="bold">
        जीत की श्रेणियां
      </Text>
      <VStack align="stretch" spacing={{ base: 2, md: 3 }}>
        {categories.map(({ key, label, lineIndex }) => {
          const claimed = claims.has(key);
          const isComplete = isPatternComplete(key, lineIndex);
          const loading = isClaimLoading === key;
          const rank = userRank(key);
          const isExpanded = expandedCategory === key;
          const rankingEntries = categoryRankings?.rankings?.[key] || [];

          return (
            <Box key={key}>
              <Box
                as={claimed ? 'button' : 'div'}
                w="100%"
                textAlign="left"
                onClick={claimed ? () => setExpandedCategory(isExpanded ? null : key) : undefined}
                cursor={claimed ? 'pointer' : 'default'}
              >
              <HStack
                justify="space-between"
                p={{ base: 3, md: 4 }}
                bg={claimed ? 'green.50' : 'white'}
                borderRadius={isExpanded ? 'md' : 'md'}
                borderBottomRadius={isExpanded ? '0' : 'md'}
                border="1px"
                borderColor={claimed ? 'green.300' : 'grey.300'}
                borderBottom={isExpanded ? '0' : '1px'}
                spacing={2}
              >
                <VStack align="start" spacing={0}>
                  <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="grey.900">{label}</Text>
                </VStack>
                <HStack spacing={2}>
                  {claimed ? (
                    <>
                      {rank && (
                        <Badge bg="highlight.500" color="white" fontSize={{ base: 'xs', md: 'sm' }} px={2.5} py={0.5} borderRadius="md" fontWeight="bold">
                          #{rank}
                        </Badge>
                      )}
                      <Badge colorScheme="green" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>
                        दावा किया ✓
                      </Badge>
                      <Text fontSize="xs" color="grey.500">{isExpanded ? '▲' : '▼'}</Text>
                    </>
                  ) : isComplete ? (
                    <Button
                      size={{ base: 'sm', md: 'md' }}
                      colorScheme="yellow"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaim(key);
                      }}
                      isLoading={loading}
                      px={{ base: 4, md: 6 }}
                    >
                      जीत का दावा करें
                    </Button>
                  ) : (
                    <Badge colorScheme="grey" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>प्रगति में</Badge>
                  )}
                </HStack>
              </HStack>
              </Box>

              {/* Expandable mini leaderboard */}
              {claimed && isExpanded && (
                <Box
                  bg="grey.50"
                  border="1px"
                  borderColor="green.300"
                  borderTop="0"
                  borderBottomRadius="md"
                  px={3}
                  py={2}
                >
                  {rankingEntries.length > 0 ? (
                    <VStack align="stretch" spacing={1}>
                      {rankingEntries.map((entry, idx) => {
                        // Show separator if there's a gap between top entries and user's entry
                        const prevRank = idx > 0 ? rankingEntries[idx - 1].rank : 0;
                        const showSeparator = entry.rank - prevRank > 1;

                        return (
                          <Box key={`${key}-${entry.rank}`}>
                            {showSeparator && (
                              <Text fontSize="xs" color="grey.400" textAlign="center" py={0.5}>• • •</Text>
                            )}
                            <HStack
                              justify="center"
                              py={1.5}
                              px={3}
                              borderRadius="md"
                              bg={entry.isCurrentUser ? 'green.100' : 'transparent'}
                              spacing={2.5}
                            >
                              <Text fontSize="xs" fontWeight="bold" color={entry.isCurrentUser ? 'green.700' : 'grey.400'} minW="24px" textAlign="right">
                                #{entry.rank}
                              </Text>
                              <Image
                                src={getAvatarUrl(entry.isCurrentUser ? 'me-player' : entry.userName)}
                                alt=""
                                w="22px"
                                h="22px"
                                borderRadius="full"
                                bg="grey.200"
                                flexShrink={0}
                              />
                              <Text fontSize="xs" fontWeight={entry.isCurrentUser ? 'bold' : 'medium'} color={entry.isCurrentUser ? 'green.800' : 'grey.700'}>
                                {entry.isCurrentUser ? 'आप' : entry.userName}
                              </Text>
                            </HStack>
                          </Box>
                        );
                      })}
                    </VStack>
                  ) : (
                    <Text fontSize="xs" color="grey.400" textAlign="center" py={1}>
                      रैंकिंग लोड हो रही है...
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
