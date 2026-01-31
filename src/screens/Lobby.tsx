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
  Icon,
  Image,
  AspectRatio,
} from '@chakra-ui/react';
import { BellIcon } from '@chakra-ui/icons';
import { apiService, type Game, type PromotionalBanner, type YouTubeEmbed } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
import { Logo } from '../components/Logo';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';

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
  const [currentBanner, setCurrentBanner] = useState<PromotionalBanner | null>(null);
  const [currentEmbed, setCurrentEmbed] = useState<YouTubeEmbed | null>(null);
  const [remindedGames, setRemindedGames] = useState<Set<string>>(() => {
    // Load reminded games from localStorage
    const saved = localStorage.getItem('remindedGames');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    loadGames();
    loadMyActiveGames();
    loadCurrentBanner();
    loadCurrentEmbed();

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
      onGameDeleted: (data) => {
        toast({
          title: 'Game Deleted',
          description: data.message || 'A game has been deleted',
          status: 'info',
          duration: 5000,
        });
        // Reload games list to reflect the deletion
        loadGames();
        loadMyActiveGames();
      },
      onError: (error) => {
        // Special handling for game not found (deleted game)
        if (error.code === 'GAME_NOT_FOUND') {
          toast({
            title: 'Game Deleted',
            description: 'Game has been deleted by the organizer',
            status: 'warning',
            duration: 5000,
          });
          // Remove the game from the list
          loadGames();
          loadMyActiveGames();
        } else {
          toast({
            title: 'Error',
            description: error.message,
            status: 'error',
            duration: 5000,
          });
        }
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

  const loadCurrentBanner = async () => {
    try {
      const banner = await apiService.getCurrentPromotionalBanner();
      setCurrentBanner(banner);
    } catch (error) {
      console.error('Failed to load promotional banner:', error);
    }
  };

  const loadCurrentEmbed = async () => {
    try {
      const embed = await apiService.getCurrentYouTubeEmbed();
      setCurrentEmbed(embed);
    } catch (error) {
      console.error('Failed to load YouTube embed:', error);
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

  const handleStartGame = async (gameId: string) => {
    try {
      // Start the game (update status to ACTIVE)
      wsService.startGame(gameId);
      await apiService.updateGameStatus(gameId, 'ACTIVE');

      // Set as current game to track events
      const game = games.find(g => g.id === gameId);
      if (game) {
        setCurrentGame(game);
      }

      toast({
        title: 'Game Started',
        description: 'Redirecting to game control...',
        status: 'success',
        duration: 2000,
      });

      // Navigate to GameControl screen (it will join the game room on mount)
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

  const handleDeleteGame = async (gameId: string) => {
    try {
      await apiService.deleteGame(gameId);
      toast({
        title: 'Game Deleted',
        status: 'success',
        duration: 3000,
      });
      loadGames();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRemindMe = (gameId: string) => {
    const updated = new Set(remindedGames);
    if (updated.has(gameId)) {
      updated.delete(gameId);
      toast({
        title: 'Reminder Removed',
        description: 'You will no longer be reminded about this game',
        status: 'info',
        duration: 3000,
      });
    } else {
      updated.add(gameId);
      toast({
        title: 'Reminder Set',
        description: 'We will remind you when the game is about to start',
        status: 'success',
        duration: 3000,
        icon: <BellIcon />,
      });
    }
    setRemindedGames(updated);
    localStorage.setItem('remindedGames', JSON.stringify(Array.from(updated)));
  };

  const canJoinGame = (scheduledTime: string): boolean => {
    const now = new Date().getTime();
    const scheduled = new Date(scheduledTime).getTime();
    const timeRemaining = scheduled - now;
    const thirtyMinutesInMs = 30 * 60 * 1000;

    // Can join if within 30 minutes or time has passed
    return timeRemaining <= thirtyMinutesInMs;
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

  // GameCountdown Component
  const GameCountdown = ({ scheduledTime }: { scheduledTime: string }) => {
    const timeRemaining = useCountdown(scheduledTime);
    const countdownText = formatCountdown(timeRemaining);

    return (
      <HStack
        justify="center"
        w="100%"
        p={3}
        bg={timeRemaining.isExpired ? 'orange.500' : 'brand.500'}
        borderRadius="md"
        spacing={2}
      >
        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="bold" color="white">
          ⏱️
        </Text>
        <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="white">
          {timeRemaining.isExpired ? 'Starting Soon' : `Starts in: ${countdownText}`}
        </Text>
      </HStack>
    );
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

        {/* Organizer Controls - Always show for organizers */}
        {(user?.email === 'organizer@test.com' || user?.role === 'ORGANIZER') && (
          <HStack spacing={4} justify="center" w="100%">
            <Button
              colorScheme="brand"
              onClick={() => navigate('/organizer')}
              size={{ base: 'sm', md: 'md' }}
              variant="solid"
            >
              Create Game
            </Button>
            <Button
              colorScheme="purple"
              onClick={() => navigate('/banner-management')}
              size={{ base: 'sm', md: 'md' }}
              variant="solid"
            >
              Manage Banner
            </Button>
          </HStack>
        )}

        {/* Games Section */}
        <Box w="100%">
          <Heading size={{ base: 'md', md: 'lg' }} mb={{ base: 3, md: 4 }} color="white" textAlign="center">
            Available Games
          </Heading>

          {games.length === 0 ? (
            <VStack spacing={{ base: 4, md: 6 }} w="100%">
              {currentBanner && (
                <Box
                  w="100%"
                  maxW={{ base: '100%', md: '800px', lg: '1000px' }}
                  mx="auto"
                  borderRadius="lg"
                  overflow="hidden"
                  boxShadow="xl"
                  border="2px"
                  borderColor="brand.500"
                >
                  <Image
                    src={currentBanner.imageUrl}
                    alt="Promotional banner"
                    w="100%"
                    objectFit="cover"
                    aspectRatio={16 / 9}
                  />
                </Box>
              )}

              {currentEmbed && (
                <Box
                  w="100%"
                  maxW={{ base: '100%', md: '800px', lg: '1000px' }}
                  mx="auto"
                  borderRadius="lg"
                  overflow="hidden"
                  boxShadow="xl"
                  border="2px"
                  borderColor="brand.500"
                >
                  <AspectRatio ratio={16 / 9}>
                    <iframe
                      src={`https://www.youtube.com/embed/${currentEmbed.embedId}`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </AspectRatio>
                </Box>
              )}

              {!currentBanner && !currentEmbed && (
                <Box
                  p={{ base: 4, md: 8 }}
                  bg="grey.700"
                  borderRadius="md"
                  textAlign="center"
                  border="1px"
                  borderColor="grey.600"
                  w="100%"
                >
                  <Text color="grey.300" fontSize={{ base: 'md', md: 'lg' }}>
                    No games available at the moment
                  </Text>
                </Box>
              )}
            </VStack>
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

                      {/* Countdown Timer */}
                      <GameCountdown scheduledTime={game.scheduledTime} />

                      {(() => {
                        const isMyGame = myActiveGames.some((g) => g.id === game.id);
                        const isCreator = game.createdBy === user?.id;

                        // If user is the creator, show different buttons based on game status
                        if (isCreator) {
                          if (game.status === 'LOBBY') {
                            // Show Start Game and Delete Game buttons
                            return (
                              <VStack w="100%" spacing={2}>
                                <Button
                                  w="100%"
                                  colorScheme="brand"
                                  size={{ base: 'md', md: 'lg' }}
                                  h={{ base: '44px', md: '48px' }}
                                  fontSize={{ base: 'sm', md: 'md' }}
                                  onClick={() => handleStartGame(game.id)}
                                >
                                  Start Game
                                </Button>
                                <Button
                                  w="100%"
                                  colorScheme="red"
                                  variant="outline"
                                  size={{ base: 'sm', md: 'md' }}
                                  h={{ base: '36px', md: '40px' }}
                                  fontSize={{ base: 'xs', md: 'sm' }}
                                  onClick={() => handleDeleteGame(game.id)}
                                >
                                  Delete Game
                                </Button>
                              </VStack>
                            );
                          } else if (game.status === 'ACTIVE') {
                            // Show Manage Game button for active games
                            return (
                              <Button
                                w="100%"
                                bg="highlight.500"
                                color="white"
                                size={{ base: 'md', md: 'lg' }}
                                h={{ base: '44px', md: '48px' }}
                                fontSize={{ base: 'sm', md: 'md' }}
                                onClick={() => navigate(`/game-control/${game.id}`)}
                                _hover={{ bg: 'highlight.600' }}
                              >
                                Manage Game
                              </Button>
                            );
                          }
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

                        // For regular players - check if within 30 minutes
                        const canJoin = canJoinGame(game.scheduledTime);
                        const isReminded = remindedGames.has(game.id);

                        // If active game, always show Join/Watch
                        if (game.status === 'ACTIVE') {
                          return (
                            <Button
                              w="100%"
                              colorScheme="brand"
                              size={{ base: 'md', md: 'lg' }}
                              h={{ base: '44px', md: '48px' }}
                              fontSize={{ base: 'sm', md: 'md' }}
                              isLoading={joiningGameId === game.id}
                              loadingText="Joining..."
                              onClick={() => handleJoinGame(game)}
                            >
                              Watch Game
                            </Button>
                          );
                        }

                        // If lobby game and can join (within 30 mins or expired)
                        if (canJoin) {
                          return (
                            <Button
                              w="100%"
                              colorScheme="brand"
                              size={{ base: 'md', md: 'lg' }}
                              h={{ base: '44px', md: '48px' }}
                              fontSize={{ base: 'sm', md: 'md' }}
                              isLoading={joiningGameId === game.id}
                              loadingText="Joining..."
                              onClick={() => handleJoinGame(game)}
                            >
                              Join Game
                            </Button>
                          );
                        }

                        // If lobby game but NOT within 30 mins - show Remind Me
                        return (
                          <Button
                            w="100%"
                            colorScheme={isReminded ? 'green' : 'yellow'}
                            variant={isReminded ? 'solid' : 'outline'}
                            size={{ base: 'md', md: 'lg' }}
                            h={{ base: '44px', md: '48px' }}
                            fontSize={{ base: 'sm', md: 'md' }}
                            leftIcon={<BellIcon />}
                            onClick={() => handleRemindMe(game.id)}
                          >
                            {isReminded ? 'Reminder Set' : 'Remind Me'}
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

        {/* Promotional Banner - shown when games exist */}
        {games.length > 0 && currentBanner && (
          <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto">
            <Box
              borderRadius="lg"
              overflow="hidden"
              boxShadow="xl"
              border="2px"
              borderColor="brand.500"
            >
              <Image
                src={currentBanner.imageUrl}
                alt="Promotional banner"
                w="100%"
                objectFit="cover"
                aspectRatio={16 / 9}
              />
            </Box>
          </Box>
        )}

        {/* YouTube Video - shown when games exist */}
        {games.length > 0 && currentEmbed && (
          <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto">
            <Box
              borderRadius="lg"
              overflow="hidden"
              boxShadow="xl"
              border="2px"
              borderColor="brand.500"
            >
              <AspectRatio ratio={16 / 9}>
                <iframe
                  src={`https://www.youtube.com/embed/${currentEmbed.embedId}`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </AspectRatio>
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
