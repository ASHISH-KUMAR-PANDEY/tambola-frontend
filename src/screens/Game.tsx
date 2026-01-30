import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Text,
  Grid,
  GridItem,
  HStack,
  VStack,
  Badge,
  useToast,
  Divider,
} from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { Ticket } from '../components/Ticket';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();

  const {
    playerId,
    ticket,
    currentNumber,
    calledNumbers,
    winners,
    players,
    addCalledNumber,
    addPlayer,
    addWinner,
    getMarkedCount,
    checkLineComplete,
    checkFullHouse,
    clearGame,
  } = useGameStore();

  useEffect(() => {
    if (!gameId) {
      navigate('/lobby');
      return;
    }

    // Join the game room
    wsService.joinGame(gameId);

    // Setup WebSocket event handlers
    wsService.on({
      onPlayerJoined: (data) => {
        addPlayer({ playerId: data.playerId, userName: data.userName });
        toast({
          title: 'Player Joined',
          description: `${data.userName} joined the game`,
          status: 'info',
          duration: 3000,
        });
      },
      onGameStarted: () => {
        toast({
          title: 'Game Started!',
          description: 'Get ready to mark your numbers',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      },
      onNumberCalled: (data) => {
        addCalledNumber(data.number);
      },
      onWinner: (data) => {
        const categoryName = data.category
          .split('_')
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' ');

        addWinner(data);

        const userName = (data as any).userName || 'Someone';
        toast({
          title: `Winner: ${categoryName}!`,
          description: `${userName} won ${categoryName}!`,
          status: 'success',
          duration: 10000,
          isClosable: true,
        });
      },
      onWinClaimed: (data) => {
        if (data.success && playerId) {
          // Add ourselves to winners list to update UI
          addWinner({
            playerId,
            category: data.category as any,
          });

          toast({
            title: 'Congratulations!',
            description: data.message,
            status: 'success',
            duration: 10000,
            isClosable: true,
          });
        }
      },
      onGameCompleted: () => {
        toast({
          title: 'Game Completed',
          description: 'Thank you for playing!',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
        setTimeout(() => {
          clearGame();
          navigate('/lobby');
        }, 3000);
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      },
    });

    return () => {
      if (gameId) {
        wsService.leaveGame(gameId);
      }
      wsService.off();
    };
  }, [gameId]);

  const handleLeaveGame = () => {
    if (gameId) {
      wsService.leaveGame(gameId);
    }
    clearGame();
    navigate('/lobby');
  };

  const handleClaimWin = (category: string) => {
    if (!gameId) return;
    wsService.claimWin(gameId, category);
  };

  const handleNumberClick = (number: number) => {
    // Number successfully marked
    console.log('Number marked:', number);
  };

  const getCategoryWinner = (category: string) => {
    return winners.find((w) => w.category === category);
  };

  const renderNumberBoard = () => {
    const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
    return (
      <Grid templateColumns={{ base: 'repeat(10, minmax(0, 1fr))', md: 'repeat(10, 1fr)' }} gap={{ base: 1, sm: 1.5, md: 2 }}>
        {numbers.map((num) => {
          const isCalled = calledNumbers.includes(num);
          const isCurrent = num === currentNumber;

          return (
            <GridItem key={num}>
              <Box
                w={{ base: '28px', sm: '32px', md: '40px' }}
                h={{ base: '28px', sm: '32px', md: '40px' }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={isCurrent ? 'orange.400' : isCalled ? 'brand.500' : 'gray.100'}
                color={isCalled || isCurrent ? 'white' : 'gray.600'}
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
    );
  };

  if (!ticket) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4}>
          <Text>No ticket found. Please join a game from the lobby.</Text>
          <Button colorScheme="brand" onClick={() => navigate('/lobby')}>
            Go to Lobby
          </Button>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={{ base: 4, md: 8 }} px={{ base: 2, md: 4 }}>
      <Stack spacing={{ base: 4, md: 8 }}>
        {/* Header */}
        <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} spacing={4}>
          <VStack align={{ base: 'center', md: 'start' }} spacing={1}>
            <Heading size={{ base: 'md', md: 'lg' }} color="brand.500">
              Tambola Game
            </Heading>
            <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>Player: {user?.name}</Text>
          </VStack>
          <Button variant="outline" colorScheme="red" onClick={handleLeaveGame} size={{ base: 'sm', md: 'md' }}>
            Leave Game
          </Button>
        </Stack>


        {/* Main Content Grid */}
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={8}>
          {/* Left Column - Your Ticket */}
          <GridItem>
            <VStack align="stretch" spacing={6}>
              <Box>
                <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 4 }}>
                  Your Ticket (Click numbers to mark)
                </Heading>
                <Ticket ticket={ticket} showMarked={true} onNumberClick={handleNumberClick} />
              </Box>

              {/* Stats */}
              <Box p={{ base: 3, md: 4 }} bg="gray.50" borderRadius="md">
                <Grid templateColumns="repeat(2, 1fr)" gap={{ base: 2, md: 4 }}>
                  <VStack>
                    <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                      Marked
                    </Text>
                    <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold" color="brand.500">
                      {getMarkedCount()}/15
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                      Called
                    </Text>
                    <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold" color="brand.500">
                      {calledNumbers.length}/90
                    </Text>
                  </VStack>
                </Grid>
              </Box>

              {/* Win Categories */}
              <Box>
                <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 3 }}>
                  Win Categories
                </Heading>
                <VStack align="stretch" spacing={2}>
                  {[
                    { key: 'EARLY_5', label: 'Early 5' },
                    { key: 'TOP_LINE', label: 'Top Line', lineIndex: 0 },
                    { key: 'MIDDLE_LINE', label: 'Middle Line', lineIndex: 1 },
                    { key: 'BOTTOM_LINE', label: 'Bottom Line', lineIndex: 2 },
                    { key: 'FULL_HOUSE', label: 'Full House' },
                  ].map(({ key, label, lineIndex }) => {
                    const winner = getCategoryWinner(key);
                    const isComplete =
                      lineIndex !== undefined
                        ? checkLineComplete(lineIndex)
                        : key === 'FULL_HOUSE'
                        ? checkFullHouse()
                        : getMarkedCount() >= 5;

                    return (
                      <Stack key={key} direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'stretch', sm: 'center' }} p={{ base: 2, md: 3 }} bg="white" borderRadius="md" border="1px" borderColor="gray.200" spacing={2}>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="medium">{label}</Text>
                        {winner ? (
                          <Badge colorScheme="green" fontSize="xs" textAlign="center">Won ✓</Badge>
                        ) : isComplete ? (
                          <Button
                            size={{ base: 'xs', md: 'sm' }}
                            colorScheme="yellow"
                            onClick={() => handleClaimWin(key)}
                          >
                            Claim Win
                          </Button>
                        ) : (
                          <Badge colorScheme="gray" fontSize="xs" textAlign="center">In Progress</Badge>
                        )}
                      </Stack>
                    );
                  })}
                </VStack>
              </Box>
            </VStack>
          </GridItem>

          {/* Right Column - Number Board */}
          <GridItem>
            <VStack align="stretch" spacing={{ base: 4, md: 6 }}>
              <Box>
                <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 4 }}>
                  Number Board
                </Heading>
                {renderNumberBoard()}
              </Box>

              <Divider />

              {/* Players & Winners */}
              <Box>
                <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 3 }}>
                  Players ({players.length})
                </Heading>
                <Box maxH="150px" overflowY="auto">
                  <VStack align="stretch" spacing={1}>
                    {players.map((player) => (
                      <Text key={player.playerId} fontSize="sm" color="gray.600">
                        {player.userName}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              </Box>

              {winners.length > 0 && (
                <Box>
                  <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 3 }}>
                    Winners
                  </Heading>
                  <VStack align="stretch" spacing={2}>
                    {winners.map((winner, index) => (
                      <Stack key={index} direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} p={{ base: 2, md: 2 }} bg="green.50" borderRadius="md" spacing={1}>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="semibold" color="green.700">
                          {winner.category.split('_').join(' ')}
                        </Text>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                          {winner.userName || 'Player'}
                        </Text>
                      </Stack>
                    ))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </GridItem>
        </Grid>
      </Stack>
    </Container>
  );
}
