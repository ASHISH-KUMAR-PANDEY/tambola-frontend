import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  Grid,
  GridItem,
  HStack,
  VStack,
  Badge,
  useToast,
  NumberInput,
  NumberInputField,
  Divider,
  Stack,
} from '@chakra-ui/react';
import { apiService } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { Logo } from '../components/Logo';

interface Winner {
  playerId: string;
  category: string;
  userName?: string;
}

export default function GameControl() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [game, setGame] = useState<any>(null);
  const [numberToCall, setNumberToCall] = useState('');
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!gameId) {
      navigate('/organizer');
      return;
    }

    loadGameData();

    // Join the game room to receive real-time updates
    wsService.joinGame(gameId);

    // Setup WebSocket
    wsService.on({
      onStateSync: (data) => {
        // Sync game state when organizer joins
        setCalledNumbers(data.calledNumbers || []);
        setCurrentNumber(data.currentNumber || null);
        setPlayers(data.players || []);
        setWinners(data.winners || []);
      },
      onPlayerJoined: (data) => {
        setPlayers((prev) => [...prev, { playerId: data.playerId, userName: data.userName }]);
        toast({
          title: 'Player Joined',
          description: `${data.userName} joined the game`,
          status: 'info',
          duration: 3000,
        });
      },
      onNumberCalled: (data) => {
        setCalledNumbers((prev) => [...prev, data.number]);
        setCurrentNumber(data.number);
      },
      onWinner: (data) => {
        setWinners((prev) => [...prev, data]);
        const userName = data.userName || 'Someone';
        const categoryName = data.category
          .split('_')
          .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' ');
        toast({
          title: `Winner: ${categoryName}!`,
          description: `${userName} won ${categoryName}!`,
          status: 'success',
          duration: 10000,
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

  const loadGameData = async () => {
    try {
      const gameData = await apiService.getGame(gameId!);
      setGame(gameData);
      setCalledNumbers(gameData.calledNumbers || []);
      setCurrentNumber(gameData.currentNumber || null);

      // Load existing winners
      if (gameData.winners && gameData.winners.length > 0) {
        setWinners(gameData.winners);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
      toast({
        title: 'Error',
        description: 'Failed to load game data',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCallNumber = async () => {
    const number = parseInt(numberToCall);
    if (!number || number < 1 || number > 90) {
      toast({
        title: 'Invalid Number',
        description: 'Please enter a number between 1 and 90',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (calledNumbers.includes(number)) {
      toast({
        title: 'Already Called',
        description: `Number ${number} has already been called`,
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    try {
      wsService.callNumber(gameId!, number);
      setNumberToCall('');
      toast({
        title: 'Number Called',
        description: `Called number: ${number}`,
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to call number',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCompleteGame = async () => {
    try {
      await apiService.updateGameStatus(gameId!, 'COMPLETED');
      toast({
        title: 'Game Completed',
        description: 'Returning to lobby...',
        status: 'success',
        duration: 2000,
      });
      navigate('/lobby');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const getWinnerForCategory = (category: string) => {
    return winners.find((w) => w.category === category);
  };

  if (!game) {
    return (
      <Box w="100vw" h="100vh" display="flex" alignItems="center" justifyContent="center" bg="grey.900">
        <Text color="white">Loading...</Text>
      </Box>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={6} w="100%" align="stretch" p={6}>
        {/* Header */}
        <Box position="relative" w="100%" minH="50px" mb={2}>
          <Box position="absolute" left={0} top={0}>
            <Logo height="28px" />
          </Box>
          <Heading
            size="xl"
            color="white"
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            whiteSpace="nowrap"
          >
            Game Control
          </Heading>
          <Button
            position="absolute"
            top={0}
            right={0}
            variant="outline"
            colorScheme="brand"
            onClick={() => navigate('/organizer')}
            size="sm"
          >
            Back to Organizer
          </Button>
        </Box>

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6} maxW="1600px" w="100%" mx="auto">
          {/* Left Column - Call Number & Grid */}
          <GridItem>
            <VStack align="stretch" spacing={6}>
              {/* Call Number Section */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4} color="grey.900">Call Number</Heading>
                <HStack spacing={3}>
                  <NumberInput
                    value={numberToCall}
                    onChange={(valueString) => setNumberToCall(valueString)}
                    min={1}
                    max={90}
                    flex={1}
                  >
                    <NumberInputField
                      placeholder="Enter number (1-90)"
                      fontSize="lg"
                      h="50px"
                      color="grey.900"
                      borderColor="grey.300"
                      _placeholder={{ color: 'grey.500' }}
                    />
                  </NumberInput>
                  <Button
                    colorScheme="orange"
                    size="lg"
                    h="50px"
                    px={8}
                    onClick={handleCallNumber}
                  >
                    Call Number
                  </Button>
                </HStack>
                {currentNumber && (
                  <Box mt={4} p={4} bg="orange.50" borderRadius="md" textAlign="center">
                    <Text fontSize="sm" color="grey.600" mb={1}>Last Called Number:</Text>
                    <Text fontSize="4xl" fontWeight="bold" color="orange.500">{currentNumber}</Text>
                  </Box>
                )}
              </Box>

              {/* Number Board */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <HStack justify="space-between" mb={4}>
                  <Heading size="md" color="grey.900">Number Board</Heading>
                  <Badge colorScheme="brand" fontSize="md" px={3} py={1}>
                    {calledNumbers.length}/90 Called
                  </Badge>
                </HStack>
                <Grid templateColumns="repeat(10, 1fr)" gap={2}>
                  {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
                    const isCalled = calledNumbers.includes(num);
                    const isCurrent = num === currentNumber;
                    return (
                      <Box
                        key={num}
                        w="100%"
                        h="45px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg={isCurrent ? 'orange.400' : isCalled ? 'brand.500' : 'grey.100'}
                        color={isCalled || isCurrent ? 'white' : 'grey.600'}
                        borderRadius="md"
                        fontWeight={isCalled ? 'bold' : 'normal'}
                        fontSize="lg"
                        border="2px"
                        borderColor={isCurrent ? 'orange.500' : 'transparent'}
                        boxShadow={isCurrent ? 'lg' : 'none'}
                        transition="all 0.2s"
                      >
                        {num}
                      </Box>
                    );
                  })}
                </Grid>
              </Box>
            </VStack>
          </GridItem>

          {/* Right Column - Stats & Winners */}
          <GridItem>
            <VStack align="stretch" spacing={6}>
              {/* Game Stats */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4} color="grey.900">Game Stats</Heading>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
                    <Text color="grey.600">Players:</Text>
                    <Text fontWeight="bold" fontSize="xl" color="grey.900">{players.length}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="grey.600">Numbers Called:</Text>
                    <Text fontWeight="bold" fontSize="xl" color="brand.500">{calledNumbers.length}/90</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="grey.600">Winners:</Text>
                    <Text fontWeight="bold" fontSize="xl" color="green.500">{winners.length}/5</Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Win Categories */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4} color="grey.900">Win Categories</Heading>
                <VStack align="stretch" spacing={3}>
                  {[
                    { key: 'EARLY_5', label: 'Early 5' },
                    { key: 'TOP_LINE', label: 'Top Line' },
                    { key: 'MIDDLE_LINE', label: 'Middle Line' },
                    { key: 'BOTTOM_LINE', label: 'Bottom Line' },
                    { key: 'FULL_HOUSE', label: 'Full House' },
                  ].map(({ key, label }) => {
                    const winner = getWinnerForCategory(key);
                    return (
                      <HStack
                        key={key}
                        justify="space-between"
                        p={4}
                        bg={winner ? 'green.50' : 'grey.50'}
                        borderRadius="md"
                        border="2px"
                        borderColor={winner ? 'green.300' : 'grey.200'}
                      >
                        <Text fontWeight="bold" fontSize="lg" color={winner ? 'green.700' : 'grey.700'}>
                          {label}
                        </Text>
                        {winner ? (
                          <VStack align="end" spacing={0}>
                            <Badge colorScheme="green" fontSize="sm" mb={1}>WON ✓</Badge>
                            <Text fontSize="sm" color="green.700" fontWeight="semibold">
                              {winner.userName || 'Unknown Player'}
                            </Text>
                          </VStack>
                        ) : (
                          <Badge colorScheme="grey" fontSize="sm">Pending</Badge>
                        )}
                      </HStack>
                    );
                  })}
                </VStack>
              </Box>

              {/* Actions */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <VStack spacing={3}>
                  <Button
                    w="100%"
                    colorScheme="red"
                    size="lg"
                    onClick={handleCompleteGame}
                  >
                    Complete Game
                  </Button>
                </VStack>
              </Box>
            </VStack>
          </GridItem>
        </Grid>
      </VStack>
    </Box>
  );
}
