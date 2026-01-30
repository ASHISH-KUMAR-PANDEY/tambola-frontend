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

      loadMyGames();
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
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <Container maxW="container.xl" py={{ base: 4, md: 8 }} px={{ base: 2, md: 4 }}>
      <Stack spacing={{ base: 4, md: 8 }}>
        {/* Header */}
        <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} spacing={4}>
          <Heading size={{ base: 'md', md: 'lg' }} color="brand.500">
            Organizer Panel
          </Heading>
          <Button variant="outline" onClick={() => navigate('/lobby')} size={{ base: 'sm', md: 'md' }}>
            Back to Lobby
          </Button>
        </Stack>

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={8}>
          {/* Left Column - Create Game */}
          <GridItem>
            <Box
              p={{ base: 4, md: 6 }}
              bg="white"
              borderRadius="lg"
              boxShadow="md"
              border="1px"
              borderColor="gray.200"
            >
              <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 4, md: 6 }}>
                Create New Game
              </Heading>

              <form onSubmit={handleCreateGame}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel>Scheduled Time (Optional)</FormLabel>
                    <Input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </FormControl>

                  <Divider />

                  <Heading size="sm">Prize Configuration</Heading>

                  <FormControl>
                    <FormLabel>Early 5</FormLabel>
                    <NumberInput value={early5Prize} onChange={(_, val) => setEarly5Prize(val)}>
                      <NumberInputField />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Top Line</FormLabel>
                    <NumberInput value={topLinePrize} onChange={(_, val) => setTopLinePrize(val)}>
                      <NumberInputField />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Middle Line</FormLabel>
                    <NumberInput value={middleLinePrize} onChange={(_, val) => setMiddleLinePrize(val)}>
                      <NumberInputField />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Bottom Line</FormLabel>
                    <NumberInput value={bottomLinePrize} onChange={(_, val) => setBottomLinePrize(val)}>
                      <NumberInputField />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Full House</FormLabel>
                    <NumberInput value={fullHousePrize} onChange={(_, val) => setFullHousePrize(val)}>
                      <NumberInputField />
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

          {/* Right Column - My Games */}
          <GridItem>
            <Box
              p={{ base: 4, md: 6 }}
              bg="white"
              borderRadius="lg"
              boxShadow="md"
              border="1px"
              borderColor="gray.200"
            >
              <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 4, md: 6 }}>
                My Games
              </Heading>

              <VStack align="stretch" spacing={4}>
                {myGames.length === 0 ? (
                  <Text color="gray.600" textAlign="center">
                    No games created yet
                  </Text>
                ) : (
                  myGames.map((game) => (
                    <Box
                      key={game.id}
                      p={4}
                      bg="gray.50"
                      borderRadius="md"
                      border="1px"
                      borderColor="gray.200"
                    >
                      <VStack align="stretch" spacing={3}>
                        <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} spacing={2}>
                          <Badge colorScheme={getStatusColor(game.status)} fontSize={{ base: 'xs', md: 'sm' }}>
                            {game.status}
                          </Badge>
                          <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                            Players: {game.playerCount || 0}
                          </Text>
                        </Stack>

                        <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} spacing={2}>
                          <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                            Full House Prize:
                          </Text>
                          <Text fontWeight="semibold" fontSize={{ base: 'sm', md: 'md' }}>{game.prizes.fullHouse} pts</Text>
                        </Stack>

                        {game.status === 'ACTIVE' && (
                          <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} spacing={2}>
                            <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                              Numbers Called:
                            </Text>
                            <Text fontWeight="semibold" fontSize={{ base: 'sm', md: 'md' }}>{game.calledNumbers?.length || 0}/90</Text>
                          </Stack>
                        )}

                        <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
                          {game.status === 'LOBBY' && (
                            <>
                              <Button
                                size="sm"
                                colorScheme="green"
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
                            </>
                          )}

                          {game.status === 'ACTIVE' && (
                            <VStack align="stretch" spacing={3} w="100%">
                              <HStack>
                                <NumberInput
                                  value={numberToCall}
                                  onChange={(valueString) => setNumberToCall(valueString)}
                                  min={1}
                                  max={90}
                                  flex={1}
                                >
                                  <NumberInputField placeholder="Enter number (1-90)" />
                                </NumberInput>
                                <Button
                                  colorScheme="orange"
                                  onClick={() => handleCallNumber(game.id)}
                                >
                                  Call Number
                                </Button>
                              </HStack>

                              {/* 90 Number Grid */}
                              <Box>
                                <Text fontSize={{ base: '2xs', md: 'xs' }} color="gray.600" mb={2}>
                                  Called Numbers:
                                </Text>
                                <Grid templateColumns={{ base: 'repeat(10, minmax(0, 1fr))', md: 'repeat(10, 1fr)' }} gap={{ base: 0.5, md: 1 }}>
                                  {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
                                    const isCalled = (calledNumbersByGame[game.id] || []).includes(num) ||
                                                      game.calledNumbers?.includes(num);
                                    return (
                                      <Box
                                        key={num}
                                        w={{ base: '24px', sm: '28px', md: '30px' }}
                                        h={{ base: '24px', sm: '28px', md: '30px' }}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        bg={isCalled ? 'brand.500' : 'gray.100'}
                                        color={isCalled ? 'white' : 'gray.600'}
                                        borderRadius="sm"
                                        fontSize={{ base: '2xs', sm: 'xs', md: 'xs' }}
                                        fontWeight={isCalled ? 'bold' : 'normal'}
                                      >
                                        {num}
                                      </Box>
                                    );
                                  })}
                                </Grid>
                              </Box>

                              {/* Won Categories */}
                              <Box>
                                <Text fontSize={{ base: '2xs', md: 'xs' }} color="gray.600" mb={2}>
                                  Won Categories:
                                </Text>
                                <VStack align="stretch" spacing={1}>
                                  {[
                                    { key: 'EARLY_5', label: 'Early 5' },
                                    { key: 'TOP_LINE', label: 'Top Line' },
                                    { key: 'MIDDLE_LINE', label: 'Middle Line' },
                                    { key: 'BOTTOM_LINE', label: 'Bottom Line' },
                                    { key: 'FULL_HOUSE', label: 'Full House' },
                                  ].map(({ key, label }) => {
                                    const isWon = wonCategories[game.id]?.has(key);
                                    return (
                                      <Stack key={key} direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} p={{ base: 1.5, md: 2 }} bg={isWon ? 'green.50' : 'gray.50'} borderRadius="sm" spacing={1}>
                                        <Text fontSize={{ base: '2xs', md: 'xs' }}>{label}</Text>
                                        {isWon ? (
                                          <Badge colorScheme="green" fontSize={{ base: '2xs', md: 'xs' }}>Won ✓</Badge>
                                        ) : (
                                          <Badge colorScheme="gray" fontSize={{ base: '2xs', md: 'xs' }}>Pending</Badge>
                                        )}
                                      </Stack>
                                    );
                                  })}
                                </VStack>
                              </Box>
                            </VStack>
                          )}
                        </Stack>
                      </VStack>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>

            {/* Active Game Players */}
            {currentGame && currentGame.status === 'ACTIVE' && (
              <Box
                mt={{ base: 4, md: 6 }}
                p={{ base: 4, md: 6 }}
                bg="white"
                borderRadius="lg"
                boxShadow="md"
                border="1px"
                borderColor="gray.200"
              >
                <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 4 }}>
                  Active Players ({players.length})
                </Heading>
                <Box maxH="200px" overflowY="auto">
                  <VStack align="stretch" spacing={1}>
                    {players.map((player) => (
                      <Text key={player.playerId} fontSize="sm" color="gray.600">
                        {player.userName}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              </Box>
            )}
          </GridItem>
        </Grid>
      </Stack>
    </Container>
  );
}
