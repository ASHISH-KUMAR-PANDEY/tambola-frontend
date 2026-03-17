import { Box, VStack, Text, Button } from '@chakra-ui/react';
import { SoloTicket } from './SoloTicket';
import { useSoloGameStore } from '../../stores/soloGameStore';

interface SoloGameResultsProps {
  onBackToLobby: () => void;
}

export function SoloGameResults({ onBackToLobby }: SoloGameResultsProps) {
  const { ticket } = useSoloGameStore();

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
