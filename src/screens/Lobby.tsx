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
import { Logo } from '../components/Logo';

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
        return 'grey';
      default:
        return 'grey';
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
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={{ base: 4, md: 6 }} w="100%" align="stretch" p={{ base: 3, md: 4 }}>
        {/* Header */}
        <Box position="relative" w="100%" minH={{ base: '40px', md: '50px' }} mb={{ base: 2, md: 3 }}>
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
            onClick={handleLogout}
            size={{ base: 'xs', md: 'sm' }}
          >
            Logout
          </Button>
        </Box>

        {/* Welcome Message */}
        <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }} textAlign="center">Welcome, {user?.name}!</Text>

        {/* Create Game Button for Organizers */}
        {(user?.email === 'organizer@test.com' || user?.role === 'ORGANIZER') && (
          <Button colorScheme="brand" onClick={() => navigate('/organizer')} size={{ base: 'sm', md: 'md' }} alignSelf="center">
            Create Game
          </Button>
        )}

        {/* Games Section */}
        <Box w="100%">
          <Heading size={{ base: 'md', md: 'lg' }} mb={{ base: 3, md: 4 }} color="white" textAlign="center">
            Available Games
          </Heading>

          {games.length === 0 ? (
            <Box
              p={{ base: 4, md: 8 }}
              bg="grey.700"
              borderRadius="md"
              textAlign="center"
              border="1px"
              borderColor="grey.600"
            >
              <Text color="grey.300" fontSize={{ base: 'md', md: 'lg' }}>
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
            <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }} gap={{ base: 3, md: 4 }} w="100%">
              {games.map((game) => (
                <GridItem key={game.id}>
                  <Box
                    p={{ base: 4, md: 5 }}
                    bg="grey.700"
                    borderRadius="lg"
                    boxShadow="md"
                    border="1px"
                    borderColor="grey.600"
                    transition="all 0.2s"
                    _hover={{ boxShadow: 'lg', transform: 'translateY(-2px)', borderColor: 'brand.500' }}
                    h="100%"
                    w="100%"
                  >
                    <VStack align="start" spacing={{ base: 3, md: 4 }} h="100%">
                      <HStack justify="space-between" w="100%" flexWrap="wrap" gap={2}>
                        <Badge colorScheme={getStatusColor(game.status)} fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>
                          {game.status}
                        </Badge>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400" whiteSpace="nowrap">
                          {formatDate(game.scheduledTime)}
                        </Text>
                      </HStack>

                      <VStack align="start" spacing={2} w="100%" flex={1}>
                        <HStack justify="space-between" w="100%">
                          <Text fontSize={{ base: 'sm', md: 'md' }} color="grey.300">
                            Players:
                          </Text>
                          <Text fontWeight="bold" fontSize={{ base: 'sm', md: 'md' }} color="white">{game.playerCount || 0}</Text>
                        </HStack>
                        <HStack justify="space-between" w="100%">
                          <Text fontSize={{ base: 'sm', md: 'md' }} color="grey.300">
                            Full House:
                          </Text>
                          <Text fontWeight="bold" color="highlight.500" fontSize={{ base: 'sm', md: 'md' }}>
                            {game.prizes.fullHouse || 0} pts
                          </Text>
                        </HStack>
                      </VStack>

                      {(() => {
                        const isMyGame = myActiveGames.some((g) => g.id === game.id);
                        const isCreator = game.createdBy === user?.id;

                        // If user is the creator, show "Manage Game" button
                        if (isCreator) {
                          return (
                            <Button
                              w="100%"
                              bg="highlight.500"
                              color="white"
                              size={{ base: 'md', md: 'lg' }}
                              h={{ base: '44px', md: '48px' }}
                              fontSize={{ base: 'sm', md: 'md' }}
                              onClick={() => navigate('/organizer')}
                              _hover={{ bg: 'highlight.600' }}
                            >
                              Manage Game
                            </Button>
                          );
                        }

                        // If user already joined, show "Rejoin Game"
                        if (isMyGame) {
                          return (
                            <Button
                              w="100%"
                              colorScheme="green"
                              size={{ base: 'md', md: 'lg' }}
                              h={{ base: '44px', md: '48px' }}
                              fontSize={{ base: 'sm', md: 'md' }}
                              isLoading={joiningGameId === game.id}
                              loadingText="Rejoining..."
                              onClick={() => handleRejoinGame(game)}
                            >
                              Rejoin Game
                            </Button>
                          );
                        }

                        // Otherwise show "Join Game" or "Watch Game"
                        return (
                          <Button
                            w="100%"
                            colorScheme="brand"
                            size={{ base: 'md', md: 'lg' }}
                            h={{ base: '44px', md: '48px' }}
                            fontSize={{ base: 'sm', md: 'md' }}
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
      </VStack>
    </Box>
  );
}
