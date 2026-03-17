import { Box, Grid, GridItem, Text } from '@chakra-ui/react';
import { useSoloGameStore } from '../../stores/soloGameStore';

interface SoloTicketProps {
  ticket: number[][];
  readOnly?: boolean;
  compact?: boolean;
}

export function SoloTicket({ ticket, readOnly = false, compact = false }: SoloTicketProps) {
  const { markNumber, isNumberCalled, isNumberMarked } = useSoloGameStore();

  const handleClick = (num: number) => {
    if (readOnly || num === 0) return;
    if (!isNumberCalled(num)) return;
    if (isNumberMarked(num)) return;
    markNumber(num);
  };

  const cellSize = compact
    ? { base: '28px', sm: '32px', md: '40px' }
    : { base: '35px', sm: '45px', md: '60px' };

  const fontSize = compact
    ? { base: 'sm', sm: 'md', md: 'md' }
    : { base: 'md', sm: 'lg', md: 'xl' };

  return (
    <Box
      border="2px"
      borderColor="brand.500"
      borderRadius="md"
      p={compact ? { base: 1, sm: 2, md: 2 } : { base: 2, sm: 3, md: 4 }}
      bg="white"
      boxShadow="md"
      w="100%"
      maxW={{ base: '100%', md: '500px' }}
      mx="auto"
    >
      {ticket.map((row, rowIndex) => (
        <Grid
          key={rowIndex}
          templateColumns={{ base: 'repeat(9, minmax(0, 1fr))', md: 'repeat(9, 1fr)' }}
          gap={compact ? { base: 0.5, sm: 1, md: 1 } : { base: 1, sm: 1.5, md: 2 }}
          mb={rowIndex < 2 ? (compact ? { base: 0.5, sm: 1, md: 1 } : { base: 1, sm: 1.5, md: 2 }) : 0}
        >
          {row.map((num, colIndex) => {
            const isCalled = num !== 0 && isNumberCalled(num);
            const isMarked = num !== 0 && isNumberMarked(num);

            return (
              <GridItem key={`${rowIndex}-${colIndex}`}>
                <Box
                  w={cellSize}
                  h={cellSize}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={
                    num === 0
                      ? 'grey.100'
                      : isMarked
                      ? 'brand.500'
                      : isCalled
                      ? 'highlight.100'
                      : 'white'
                  }
                  border="1px"
                  borderColor={num === 0 ? 'grey.200' : 'brand.300'}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize={fontSize}
                  color={
                    num === 0
                      ? 'transparent'
                      : isMarked
                      ? 'white'
                      : 'grey.900'
                  }
                  transition="all 0.2s"
                  cursor={!readOnly && num !== 0 && isCalled && !isMarked ? 'pointer' : 'default'}
                  onClick={() => handleClick(num)}
                  _hover={
                    !readOnly && num !== 0 && isCalled && !isMarked
                      ? {
                          transform: 'scale(1.05)',
                          boxShadow: 'md',
                          bg: 'brand.50',
                        }
                      : {}
                  }
                >
                  <Text userSelect="none">{num !== 0 ? num : ''}</Text>
                </Box>
              </GridItem>
            );
          })}
        </Grid>
      ))}
    </Box>
  );
}
