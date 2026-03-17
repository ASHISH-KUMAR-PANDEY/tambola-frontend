import { Box, HStack, Button, VStack, Text, Badge } from '@chakra-ui/react';
import { useSoloGameStore, type WinCategory } from '../../stores/soloGameStore';

interface SoloClaimButtonsProps {
  onClaim: (category: WinCategory) => void;
  isClaimLoading: WinCategory | null;
}

const categories: { key: WinCategory; label: string; lineIndex?: number }[] = [
  { key: 'EARLY_5', label: 'पहले पांच' },
  { key: 'TOP_LINE', label: 'ऊपर वाली लाइन', lineIndex: 0 },
  { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन', lineIndex: 1 },
  { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन', lineIndex: 2 },
  { key: 'FULL_HOUSE', label: 'सारे नंबर' },
];

export function SoloClaimButtons({ onClaim, isClaimLoading }: SoloClaimButtonsProps) {
  const { claims, checkEarly5, checkLineComplete, checkFullHouse } = useSoloGameStore();

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

          return (
            <HStack
              key={key}
              justify="space-between"
              p={{ base: 3, md: 4 }}
              bg={claimed ? 'green.50' : 'white'}
              borderRadius="md"
              border="1px"
              borderColor={claimed ? 'green.300' : 'grey.300'}
              spacing={2}
              opacity={claimed ? 0.8 : 1}
            >
              <VStack align="start" spacing={0}>
                <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="grey.900">{label}</Text>
              </VStack>
              {claimed ? (
                <Badge colorScheme="green" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>
                  दावा किया ✓
                </Badge>
              ) : isComplete ? (
                <Button
                  size={{ base: 'sm', md: 'md' }}
                  colorScheme="yellow"
                  onClick={() => onClaim(key)}
                  isLoading={loading}
                  px={{ base: 4, md: 6 }}
                >
                  जीत का दावा करें
                </Button>
              ) : (
                <Badge colorScheme="grey" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>प्रगति में</Badge>
              )}
            </HStack>
          );
        })}
      </VStack>
    </Box>
  );
}
