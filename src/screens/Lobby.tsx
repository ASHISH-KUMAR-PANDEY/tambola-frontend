import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Text,
  Badge,
  Grid,
  GridItem,
  Spinner,
  Center,
  HStack,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { apiService, type Game } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';

export default function Lobby() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuthStore();
  const { setCurrentGame, setTicket, restoreGameState } = useGameStore();
  const { setConnected } = useUIStore();

  const [games, setGames] = useState<Game[]>([]);
  const [myActiveGames, setMyActiveGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
    loadMyActiveGames();

    // Setup WebSocket event handlers
    wsService.on({
      onConnected: () => {
        setConnected(true);
        toast({
          title: 'Connected',
          description: 'Real-time connection established',
          status: 'success',
          duration: 3000,
        });
      },
      onDisconnected: () => {
        setConnected(false);
        toast({
          title: 'Disconnected',
          description: 'Connection lost. Reconnecting...',
          status: 'warning',
          duration: 3000,
        });
      },
      onGameJoined: (data) => {
        setTicket(data.playerId, data.ticket);
        setJoiningGameId(null);
        navigate(`/game/${data.gameId}`);
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
        setJoiningGameId(null);
      },
    });

    return () => {
      wsService.off();
    };
  }, []);

  const loadGames = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getGames();
      const allGames = (response as any).games || response;
      const validGames = Array.isArray(allGames) ? allGames : [];
      setGames(validGames.filter((g) => g.status === 'LOBBY' || g.status === 'ACTIVE'));
    } catch (error) {
      console.error('Failed to load games:', error);
      setGames([]);
      toast({
        title: 'Error',
        description: 'Failed to load games',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyActiveGames = async () => {
    try {
      const activeGames = await apiService.getMyActiveGames();
      setMyActiveGames(activeGames);
    } catch (error) {
      console.error('Failed to load active games:', error);
      setMyActiveGames([]);
    }
  };

  const handleJoinGame = async (game: Game) => {
    setJoiningGameId(game.id);
    setCurrentGame(game);
    wsService.joinGame(game.id);
  };

  const handleRejoinGame = async (game: Game) => {
    setJoiningGameId(game.id);
    setCurrentGame(game);

    // Restore full game state from myActiveGames
    const activeGame = myActiveGames.find((g) => g.id === game.id);
    if (activeGame && activeGame.ticket && activeGame.playerId) {
      restoreGameState(
        activeGame.playerId,
        activeGame.ticket,
        activeGame.markedNumbers || [],
        activeGame.calledNumbers || []
      );
    }

    // Navigate directly to game
    navigate(`/game/${game.id}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  return (
    <Container maxW="container.xl" py={{ base: 4, md: 8 }} px={{ base: 2, md: 4 }}>
      <Stack spacing={{ base: 4, md: 8 }}>
        {/* Header */}
        <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} spacing={4}>
          <VStack align={{ base: 'center', md: 'start' }} spacing={1}>
            <Heading size={{ base: 'md', md: 'lg' }} color="brand.500">
              Tambola Game Lobby
            </Heading>
            <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>Welcome, {user?.name}!</Text>
          </VStack>
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={{ base: 2, md: 4 }}>
            {(user?.email === 'organizer@test.com' || user?.role === 'ORGANIZER') && (
              <Button colorScheme="brand" onClick={() => navigate('/organizer')} size={{ base: 'sm', md: 'md' }}>
                Create Game
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout} size={{ base: 'sm', md: 'md' }}>
              Logout
            </Button>
          </Stack>
        </Stack>

        {/* Games Grid */}
        <Box>
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 4 }}>
            Available Games
          </Heading>

          {games.length === 0 ? (
            <Box
              p={{ base: 4, md: 8 }}
              bg="gray.50"
              borderRadius="md"
              textAlign="center"
              border="1px"
              borderColor="gray.200"
            >
              <Text color="gray.600" fontSize={{ base: 'md', md: 'lg' }}>
                No games available at the moment
              </Text>
              {(user?.email === 'organizer@test.com' || user?.role === 'ORGANIZER') && (
                <Button
                  mt={4}
                  colorScheme="brand"
                  onClick={() => navigate('/organizer')}
                  size={{ base: 'sm', md: 'md' }}
                >
                  Create a Game
                </Button>
              )}
            </Box>
          ) : (
            <Grid templateColumns={{ base: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' }} gap={{ base: 4, md: 6 }}>
              {games.map((game) => (
                <GridItem key={game.id}>
                  <Box
                    p={{ base: 4, md: 6 }}
                    bg="white"
                    borderRadius="lg"
                    boxShadow="md"
                    border="1px"
                    borderColor="gray.200"
                    transition="all 0.2s"
                    _hover={{ boxShadow: 'lg', transform: 'translateY(-2px)' }}
                  >
                    <VStack align="start" spacing={{ base: 3, md: 4 }}>
                      <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'start', sm: 'center' }} w="100%" spacing={2}>
                        <Badge colorScheme={getStatusColor(game.status)} fontSize={{ base: 'xs', md: 'sm' }}>
                          {game.status}
                        </Badge>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                          {formatDate(game.scheduledTime)}
                        </Text>
                      </Stack>

                      <VStack align="start" spacing={2} w="100%">
                        <Stack direction={{ base: 'row' }} justify="space-between" w="100%">
                          <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                            Players:
                          </Text>
                          <Text fontWeight="semibold" fontSize={{ base: 'xs', md: 'sm' }}>{game.playerCount || 0}</Text>
                        </Stack>
                        <Stack direction={{ base: 'row' }} justify="space-between" w="100%">
                          <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.600">
                            Full House:
                          </Text>
                          <Text fontWeight="semibold" color="brand.500" fontSize={{ base: 'xs', md: 'sm' }}>
                            {game.prizes.fullHouse || 0} pts
                          </Text>
                        </Stack>
                      </VStack>

                      {(() => {
                        const isMyGame = myActiveGames.some((g) => g.id === game.id);

                        if (isMyGame) {
                          return (
                            <Button
                              w="100%"
                              colorScheme="green"
                              size={{ base: 'md', md: 'lg' }}
                              isLoading={joiningGameId === game.id}
                              loadingText="Rejoining..."
                              onClick={() => handleRejoinGame(game)}
                            >
                              Rejoin Game
                            </Button>
                          );
                        }

                        return (
                          <Button
                            w="100%"
                            colorScheme="brand"
                            size={{ base: 'md', md: 'lg' }}
                            isLoading={joiningGameId === game.id}
                            loadingText="Joining..."
                            isDisabled={game.status !== 'LOBBY' && game.status !== 'ACTIVE'}
                            onClick={() => handleJoinGame(game)}
                          >
                            {game.status === 'ACTIVE' ? 'Watch Game' : 'Join Game'}
                          </Button>
                        );
                      })()}
                    </VStack>
                  </Box>
                </GridItem>
              ))}
            </Grid>
          )}
        </Box>
      </Stack>
    </Container>
  );
}
