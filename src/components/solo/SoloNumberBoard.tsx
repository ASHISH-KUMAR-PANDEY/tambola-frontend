import { Box, Grid, GridItem } from '@chakra-ui/react';
import { useSoloGameStore } from '../../stores/soloGameStore';

export function SoloNumberBoard() {
  const { isNumberCalled, getCurrentNumber } = useSoloGameStore();
  const currentNumber = getCurrentNumber();
  const numbers = Array.from({ length: 90 }, (_, i) => i + 1);

  return (
    <Box w="100%" maxW={{ base: '100%', md: '500px' }} mx="auto">
      <Grid templateColumns={{ base: 'repeat(10, minmax(0, 1fr))', md: 'repeat(10, 1fr)' }} gap={{ base: 1, sm: 1.5, md: 2 }}>
        {numbers.map((num) => {
          const called = isNumberCalled(num);
          const isCurrent = num === currentNumber;

          return (
            <GridItem key={num}>
              <Box
                w={{ base: '28px', sm: '32px', md: '40px' }}
                h={{ base: '28px', sm: '32px', md: '40px' }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={isCurrent ? 'orange.400' : called ? 'brand.500' : 'grey.100'}
                color={called || isCurrent ? 'white' : 'grey.500'}
                borderRadius="md"
                fontWeight={isCurrent ? 'bold' : 'normal'}
                fontSize={{ base: isCurrent ? 'sm' : 'xs', sm: isCurrent ? 'md' : 'sm', md: isCurrent ? 'lg' : 'md' }}
                border="2px"
                borderColor={isCurrent ? 'orange.500' : 'transparent'}
                transition="all 0.3s"
                boxShadow={isCurrent ? 'lg' : 'none'}
              >
                {num}
              </Box>
            </GridItem>
          );
        })}
      </Grid>
    </Box>
  );
}
