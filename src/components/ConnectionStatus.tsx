import { Box, HStack, Text, Spinner } from '@chakra-ui/react';
import { useUIStore } from '../stores/uiStore';

export const ConnectionStatus = () => {
  const { isConnected, isReconnecting } = useUIStore();

  if (isConnected && !isReconnecting) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={4}
      right={4}
      bg={isReconnecting ? 'yellow.500' : 'red.500'}
      color="white"
      px={4}
      py={2}
      borderRadius="md"
      boxShadow="lg"
      zIndex={1000}
    >
      <HStack spacing={2}>
        {isReconnecting && <Spinner size="sm" />}
        <Text fontSize="sm" fontWeight="semibold">
          {isReconnecting ? 'Reconnecting...' : 'Disconnected'}
        </Text>
      </HStack>
    </Box>
  );
};
