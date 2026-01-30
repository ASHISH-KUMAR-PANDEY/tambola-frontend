import { Box, Grid, GridItem, Text, useToast } from '@chakra-ui/react';
import { useGameStore } from '../stores/gameStore';

interface TicketProps {
  ticket: number[][];
  showMarked?: boolean;
  compact?: boolean;
  onNumberClick?: (number: number) => void;
}

export const Ticket = ({ ticket, showMarked = true, compact = false, onNumberClick }: TicketProps) => {
  const { isNumberMarked, markNumber } = useGameStore();
  const toast = useToast();

  const cellSize = compact
    ? { base: '28px', sm: '32px', md: '40px' }
    : { base: '35px', sm: '45px', md: '60px' };
  const fontSize = compact
    ? { base: 'sm', sm: 'md', md: 'md' }
    : { base: 'md', sm: 'lg', md: 'xl' };

  const handleCellClick = (cell: number) => {
    if (cell === 0 || !onNumberClick) return;

    try {
      markNumber(cell);
      onNumberClick(cell);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NUMBER_NOT_CALLED') {
          toast({
            title: 'Number Not Called',
            description: `Number ${cell} has not been called yet`,
            status: 'error',
            duration: 3000,
          });
        } else if (error.message === 'NUMBER_NOT_ON_TICKET') {
          toast({
            title: 'Invalid Number',
            description: `Number ${cell} is not on your ticket`,
            status: 'error',
            duration: 3000,
          });
        }
      }
    }
  };

  return (
    <Box
      border="2px"
      borderColor="brand.500"
      borderRadius="md"
      p={compact ? { base: 1, sm: 2, md: 2 } : { base: 2, sm: 3, md: 4 }}
      bg="white"
      boxShadow="md"
    >
      {ticket.map((row, rowIndex) => (
        <Grid
          key={rowIndex}
          templateColumns={{ base: 'repeat(9, minmax(0, 1fr))', md: 'repeat(9, 1fr)' }}
          gap={compact ? { base: 0.5, sm: 1, md: 1 } : { base: 1, sm: 1.5, md: 2 }}
          mb={rowIndex < 2 ? (compact ? { base: 0.5, sm: 1, md: 1 } : { base: 1, sm: 1.5, md: 2 }) : 0}
        >
          {row.map((cell, colIndex) => (
            <GridItem key={`${rowIndex}-${colIndex}`}>
              <Box
                w={cellSize}
                h={cellSize}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={
                  cell === 0
                    ? 'grey.100'
                    : showMarked && isNumberMarked(cell)
                    ? 'brand.500'
                    : 'white'
                }
                border="1px"
                borderColor={cell === 0 ? 'grey.200' : 'brand.300'}
                borderRadius="md"
                fontWeight="bold"
                fontSize={fontSize}
                color={
                  cell === 0
                    ? 'transparent'
                    : showMarked && isNumberMarked(cell)
                    ? 'white'
                    : 'grey.900'
                }
                transition="all 0.2s"
                cursor={cell !== 0 && onNumberClick ? 'pointer' : 'default'}
                onClick={() => handleCellClick(cell)}
                _hover={
                  cell !== 0 && onNumberClick
                    ? {
                        transform: 'scale(1.05)',
                        boxShadow: 'md',
                        bg: isNumberMarked(cell) ? 'brand.600' : 'brand.50',
                      }
                    : {}
                }
              >
                <Text>{cell !== 0 ? cell : ''}</Text>
              </Box>
            </GridItem>
          ))}
        </Grid>
      ))}
    </Box>
  );
};
