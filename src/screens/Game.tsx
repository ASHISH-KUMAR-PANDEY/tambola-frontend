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
import { Logo } from '../components/Logo';

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
    syncGameState,
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

    // Join the game room (backend will return existing ticket if already joined)
    wsService.joinGame(gameId);

    // Setup WebSocket event handlers
    wsService.on({
      onStateSync: (data) => {
        // Sync game state when rejoining
        syncGameState(
          data.calledNumbers,
          data.currentNumber || null,
          data.players,
          data.winners as any
        );
      },
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
    // Number successfully marked in frontend state, now sync to backend
    if (gameId && playerId) {
      wsService.markNumber(gameId, playerId, number);
    }
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
                bg={isCurrent ? 'orange.400' : isCalled ? 'brand.500' : 'grey.100'}
                color={isCalled || isCurrent ? 'white' : 'grey.500'}
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
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={{ base: 3, md: 4 }} w="100%" align="stretch" p={{ base: 3, md: 4 }}>
        {/* Header */}
        <Box position="relative" w="100%" minH={{ base: '40px', md: '50px' }} mb={{ base: 1, md: 2 }}>
          <Box position="absolute" left={0} top={0}>
            <Logo height={{ base: '24px', md: '28px' }} />
          </Box>
          <Heading
            size={{ base: 'lg', md: 'xl' }}
            color="white"
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            whiteSpace="nowrap"
          >
            TAMBOLA
          </Heading>
          <Button
            position="absolute"
            top={0}
            right={0}
            variant="outline"
            colorScheme="red"
            onClick={handleLeaveGame}
            size={{ base: 'xs', md: 'sm' }}
            borderWidth="2px"
          >
            Leave
          </Button>
        </Box>

        {/* Your Ticket */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            Your Ticket (Click numbers to mark)
          </Heading>
          <Ticket ticket={ticket} showMarked={true} onNumberClick={handleNumberClick} />
        </Box>

        {/* Stats - Compact */}
        <HStack spacing={{ base: 4, md: 6 }} justify="center" w="100%">
          <HStack spacing={2}>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400">Marked:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="brand.500">
              {getMarkedCount()}/15
            </Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400">Called:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="brand.500">
              {calledNumbers.length}/90
            </Text>
          </HStack>
        </HStack>

        {/* Win Categories */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            Win Categories
          </Heading>
          <VStack align="stretch" spacing={{ base: 2, md: 3 }}>
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
                <HStack key={key} justify="space-between" p={{ base: 3, md: 4 }} bg="white" borderRadius="md" border="1px" borderColor="grey.300" spacing={2}>
                  <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="grey.900">{label}</Text>
                  {winner ? (
                    <Badge colorScheme="green" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>Won ✓</Badge>
                  ) : isComplete ? (
                    <Button
                      size={{ base: 'sm', md: 'md' }}
                      colorScheme="yellow"
                      onClick={() => handleClaimWin(key)}
                      px={{ base: 4, md: 6 }}
                    >
                      Claim Win
                    </Button>
                  ) : (
                    <Badge colorScheme="grey" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>In Progress</Badge>
                  )}
                </HStack>
              );
            })}
          </VStack>
        </Box>

        {/* Number Board */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            Number Board
          </Heading>
          {renderNumberBoard()}
        </Box>

        {/* Winners */}
        {winners.length > 0 && (
          <Box w="100%" maxW="600px" mx="auto">
            <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
              Winners
            </Heading>
            <VStack align="stretch" spacing={2}>
              {winners.map((winner, index) => (
                <HStack key={index} justify="space-between" p={{ base: 2, md: 3 }} bg="green.50" borderRadius="md" spacing={2}>
                  <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="semibold" color="green.700">
                    {winner.category.split('_').join(' ')}
                  </Text>
                  <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.600">
                    {winner.userName || 'Player'}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
