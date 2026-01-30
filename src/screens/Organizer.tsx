import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  VStack,
  HStack,
  Text,
  Grid,
  GridItem,
  Badge,
  useToast,
  Divider,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react';
import { apiService, type Game } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { useGameStore } from '../stores/gameStore';
import { Logo } from '../components/Logo';

export default function Organizer() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentGame, setCurrentGame, players, addPlayer } = useGameStore();

  const [isCreating, setIsCreating] = useState(false);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [numberToCall, setNumberToCall] = useState('');
  const [calledNumbersByGame, setCalledNumbersByGame] = useState<Record<string, number[]>>({});
  const [wonCategories, setWonCategories] = useState<Record<string, Set<string>>>({});

  // Form state
  const [scheduledTime, setScheduledTime] = useState('');
  const [early5Prize, setEarly5Prize] = useState(100);
  const [topLinePrize, setTopLinePrize] = useState(200);
  const [middleLinePrize, setMiddleLinePrize] = useState(200);
  const [bottomLinePrize, setBottomLinePrize] = useState(200);
  const [fullHousePrize, setFullHousePrize] = useState(500);

  useEffect(() => {
    loadMyGames();

    return () => {
      // Clean up when component unmounts
      if (currentGame?.id) {
        wsService.leaveGame(currentGame.id);
      }
    };
  }, []);

  useEffect(() => {
    // Initialize wonCategories when games load
    const activeGames = myGames.filter(g => g.status === 'ACTIVE');
    activeGames.forEach(game => {
      if (game.id && !wonCategories[game.id]) {
        setWonCategories(prev => ({
          ...prev,
          [game.id]: new Set(),
        }));
      }
    });
  }, [myGames]);

  useEffect(() => {
    // Setup WebSocket handlers for organizer
    wsService.on({
      onPlayerJoined: (data) => {
        addPlayer({ playerId: data.playerId, userName: data.userName });
      },
      onGameStarted: () => {
        toast({
          title: 'Game Started',
          status: 'success',
          duration: 3000,
        });
        loadMyGames();
      },
      onNumberCalled: (data) => {
        // Update called numbers for ALL games (we'll get the gameId from context)
        // For now, update the current game and reload games list
        loadMyGames();
      },
      onWinner: (data) => {
        // Update won categories using currentGame
        if (currentGame?.id) {
          setWonCategories((prev) => {
            const existingCategories = prev[currentGame.id] || new Set();
            // Only add if not already won (prevent duplicates)
            if (!existingCategories.has(data.category)) {
              return {
                ...prev,
                [currentGame.id]: new Set([...existingCategories, data.category]),
              };
            }
            return prev;
          });
        }

        toast({
          title: `Winner: ${(data as any).userName || 'Player'}`,
          description: `${data.category.split('_').join(' ')} won!`,
          status: 'success',
          duration: 5000,
        });

        // Reload games to update UI
        setTimeout(() => loadMyGames(), 500);
      },
    });

    return () => {
      wsService.off();
    };
  }, [currentGame]);

  const loadMyGames = async () => {
    try {
      const response = await apiService.getGames();
      const allGames = (response as any).games || response;
      setMyGames(Array.isArray(allGames) ? allGames : []);
    } catch (error) {
      console.error('Failed to load games:', error);
      setMyGames([]);
      toast({
        title: 'Error',
        description: 'Failed to load games',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const game = await apiService.createGame({
        scheduledTime: scheduledTime || new Date().toISOString(),
        prizes: {
          early5: early5Prize,
          topLine: topLinePrize,
          middleLine: middleLinePrize,
          bottomLine: bottomLinePrize,
          fullHouse: fullHousePrize,
        },
      });

      toast({
        title: 'Game Created',
        description: 'Your game has been created successfully',
        status: 'success',
        duration: 5000,
      });

      setCurrentGame(game);
      loadMyGames();

      // Reset form
      setScheduledTime('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create game',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartGame = async (gameId: string) => {
    try {
      // Join the game room first to receive events
      wsService.joinGame(gameId);

      // Start the game
      wsService.startGame(gameId);
      await apiService.updateGameStatus(gameId, 'ACTIVE');

      // Set as current game to track events
      const game = myGames.find(g => g.id === gameId);
      if (game) {
        setCurrentGame(game);
      }

      toast({
        title: 'Game Started',
        description: 'Redirecting to game control...',
        status: 'success',
        duration: 2000,
      });

      // Navigate to GameControl screen
      navigate(`/game-control/${gameId}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCallNumber = (gameId: string) => {
    const num = parseInt(numberToCall);
    if (isNaN(num) || num < 1 || num > 90) {
      toast({
        title: 'Invalid Number',
        description: 'Please enter a number between 1 and 90',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Find the game to check already called numbers
    const game = myGames.find(g => g.id === gameId);
    const alreadyCalled = game?.calledNumbers || [];
    if (alreadyCalled.includes(num)) {
      toast({
        title: 'Number Already Called',
        description: `Number ${num} has already been called`,
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    wsService.callNumber(gameId, num);

    // Optimistically update local state
    setCalledNumbersByGame((prev) => ({
      ...prev,
      [gameId]: [...(prev[gameId] || []), num],
    }));

    setNumberToCall('');

    // Reload games to get updated state from server
    setTimeout(() => loadMyGames(), 500);
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await apiService.deleteGame(gameId);
      toast({
        title: 'Game Deleted',
        status: 'success',
        duration: 3000,
      });
      loadMyGames();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LOBBY':
        return 'green';
      case 'ACTIVE':
        return 'orange';
      case 'COMPLETED':
        return 'grey';
      default:
        return 'grey';
    }
  };

  const upcomingGames = myGames.filter(g => g.status === 'LOBBY');

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
            TAMBOLA - Organizer
          </Heading>
          <Button
            position="absolute"
            top={0}
            right={0}
            variant="outline"
            colorScheme="brand"
            onClick={() => navigate('/lobby')}
            size="sm"
          >
            Back to Lobby
          </Button>
        </Box>

        <Grid templateColumns={{ base: '1fr', lg: '500px 1fr' }} gap={8} maxW="1400px" w="100%" mx="auto">
          {/* Left Column - Create Game */}
          <GridItem>
            <Box
              p={{ base: 4, md: 6 }}
              bg="white"
              borderRadius="lg"
              boxShadow="md"
              border="1px"
              borderColor="grey.200"
            >
              <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 4, md: 6 }} color="grey.900">
                Create New Game
              </Heading>

              <form onSubmit={handleCreateGame}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Scheduled Time (Optional)</FormLabel>
                    <Input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      color="grey.900"
                      borderColor="grey.300"
                    />
                  </FormControl>

                  <Divider borderColor="grey.300" />

                  <Heading size="sm" color="grey.900">Prize Configuration</Heading>

                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Early 5</FormLabel>
                    <NumberInput value={early5Prize} onChange={(_, val) => setEarly5Prize(val)}>
                      <NumberInputField color="grey.900" borderColor="grey.300" />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Top Line</FormLabel>
                    <NumberInput value={topLinePrize} onChange={(_, val) => setTopLinePrize(val)}>
                      <NumberInputField color="grey.900" borderColor="grey.300" />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Middle Line</FormLabel>
                    <NumberInput value={middleLinePrize} onChange={(_, val) => setMiddleLinePrize(val)}>
                      <NumberInputField color="grey.900" borderColor="grey.300" />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Bottom Line</FormLabel>
                    <NumberInput value={bottomLinePrize} onChange={(_, val) => setBottomLinePrize(val)}>
                      <NumberInputField color="grey.900" borderColor="grey.300" />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Full House</FormLabel>
                    <NumberInput value={fullHousePrize} onChange={(_, val) => setFullHousePrize(val)}>
                      <NumberInputField color="grey.900" borderColor="grey.300" />
                    </NumberInput>
                  </FormControl>

                  <Button
                    type="submit"
                    colorScheme="brand"
                    size="lg"
                    isLoading={isCreating}
                    loadingText="Creating..."
                  >
                    Create Game
                  </Button>
                </VStack>
              </form>
            </Box>
          </GridItem>

          {/* Right Column - Upcoming Games */}
          <GridItem>
            <VStack align="stretch" spacing={6}>
              {/* Upcoming Games Section */}
              <Box
                p={6}
                bg="white"
                borderRadius="lg"
                boxShadow="md"
                border="1px"
                borderColor="grey.200"
              >
                <Heading size="md" mb={4}>
                  Upcoming Games
                </Heading>

                <VStack align="stretch" spacing={4}>
                  {upcomingGames.length === 0 ? (
                    <Text color="grey.600" textAlign="center">
                      No upcoming games
                    </Text>
                  ) : (
                    upcomingGames.map((game) => (
                    <Box
                      key={game.id}
                      p={4}
                      bg="grey.50"
                      borderRadius="md"
                      border="1px"
                      borderColor="grey.200"
                    >
                      <VStack align="stretch" spacing={3}>
                        <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} spacing={2}>
                          <Badge colorScheme={getStatusColor(game.status)} fontSize={{ base: 'xs', md: 'sm' }}>
                            {game.status}
                          </Badge>
                          <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.600">
                            Players: {game.playerCount || 0}
                          </Text>
                        </Stack>

                        <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} spacing={2}>
                          <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.600">
                            Full House Prize:
                          </Text>
                          <Text fontWeight="semibold" fontSize={{ base: 'sm', md: 'md' }}>{game.prizes.fullHouse} pts</Text>
                        </Stack>

                        <HStack spacing={2} justify="flex-end">
                          <Button
                            size="sm"
                            colorScheme="brand"
                            onClick={() => handleStartGame(game.id)}
                          >
                            Start Game
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="red"
                            variant="outline"
                            onClick={() => handleDeleteGame(game.id)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>
          </VStack>
        </GridItem>
      </Grid>
    </VStack>
  </Box>
);
}

