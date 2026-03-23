import { Box, VStack, HStack, Text } from '@chakra-ui/react';

// ─── Winner Data (update weekly) ─────────────────────────────
const WINNERS = [
  { category: 'पहले पांच', name: 'Neeraj Kumar', emoji: '🎯' },
  { category: 'ऊपर वाली लाइन', name: 'Shiwaji Modi', emoji: '🥇' },
  { category: 'बीच वाली लाइन', name: 'Akshay Mote', emoji: '🥇' },
  { category: 'नीचे वाली लाइन', name: 'Sunny', emoji: '🥇' },
  { category: 'सारे नंबर', name: 'Rajeev Rana', emoji: '🏆' },
];

export function SoloLegends() {
  return (
    <Box
      w="100%"
      borderRadius="12px"
      overflow="hidden"
      border="1px solid"
      borderColor="rgba(239, 167, 63, 0.3)"
      bg="linear-gradient(180deg, rgba(239, 167, 63, 0.08) 0%, rgba(30, 30, 30, 1) 100%)"
    >
      {/* Header */}
      <Box
        py={3}
        bg="linear-gradient(135deg, rgba(239, 167, 63, 0.2) 0%, rgba(239, 167, 63, 0.08) 100%)"
        borderBottom="1px solid"
        borderColor="rgba(239, 167, 63, 0.2)"
        textAlign="center"
      >
        <Text fontSize="xs" fontWeight="bold" color="highlight.400" letterSpacing="wider" textTransform="uppercase">
          🏆 Live Tambola — पिछले हफ्ते के विजेता 🏆
        </Text>
      </Box>

      {/* Winner rows */}
      <VStack spacing={0} px={3} py={2}>
        {WINNERS.map((w, i) => (
          <HStack
            key={w.category}
            w="100%"
            justify="space-between"
            align="center"
            py={2.5}
            px={3}
            borderBottom={i < WINNERS.length - 1 ? '1px solid' : 'none'}
            borderColor="rgba(255,255,255,0.06)"
            borderRadius={i === WINNERS.length - 1 ? 'md' : 'none'}
            bg={i === WINNERS.length - 1 ? 'rgba(239, 167, 63, 0.08)' : 'transparent'}
          >
            <HStack spacing={2}>
              <Text fontSize="md">{w.emoji}</Text>
              <Text
                fontSize="xs"
                color="grey.400"
                fontWeight="semibold"
              >
                {w.category}
              </Text>
            </HStack>
            <Text
              fontSize="sm"
              fontWeight="bold"
              color="highlight.400"
              textAlign="right"
            >
              {w.name}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
