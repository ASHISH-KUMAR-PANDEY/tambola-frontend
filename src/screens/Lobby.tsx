import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  Badge,
  Grid,
  GridItem,
  Spinner,
  Center,
  HStack,
  VStack,
  useToast,
  Image,
  AspectRatio,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  FormControl,
} from '@chakra-ui/react';
import { BellIcon } from '@chakra-ui/icons';
import { apiService, type Game, type PromotionalBanner, type YouTubeEmbed, type RegistrationCard as RegistrationCardType } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
import { Logo } from '../components/Logo';
import { RegistrationCard } from '../components/RegistrationCard';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useTambolaTracking } from '../hooks/useTambolaTracking';

export default function Lobby() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuthStore();
  const { setCurrentGame, setTicket, restoreGameState } = useGameStore();
  const { setConnected } = useUIStore();
  const { trackEvent } = useTambolaTracking();

  const [games, setGames] = useState<Game[]>([]);
  const [myActiveGames, setMyActiveGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState<PromotionalBanner | null>(null);
  const [currentEmbed, setCurrentEmbed] = useState<YouTubeEmbed | null>(null);
  const [currentRegistrationCard, setCurrentRegistrationCard] = useState<RegistrationCardType | null>(null);
  const [remindedGames, setRemindedGames] = useState<Set<string>>(() => {
    // Load reminded games from localStorage
    const saved = localStorage.getItem('remindedGames');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showNameModal, setShowNameModal] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    // Only show name modal for players, not organizers
    // Check user role to determine if they're an organizer
    console.log('[Lobby] ===== NAME MODAL CHECK =====');
    console.log('[Lobby] User role:', user?.role);
    console.log('[Lobby] User:', user);
    console.log('[Lobby] playerName state:', playerName);
    console.log('[Lobby] localStorage playerName:', localStorage.getItem('playerName'));

    if (user?.role === 'ORGANIZER') {
      // This is an organizer, skip name modal
      console.log('[Lobby] ✓ User is ORGANIZER, skipping name modal');
      setShowNameModal(false);
    } else {
      // This is a player (role is 'PLAYER' or undefined)
      // Check name from: 1) user object (from backend), 2) localStorage
      const userName = user?.name;
      const savedName = localStorage.getItem('playerName');
      console.log('[Lobby] User is PLAYER or undefined role');
      console.log('[Lobby] User name from backend:', userName);
      console.log('[Lobby] Saved name from localStorage:', savedName);

      // Priority: backend userName > localStorage
      const finalName = userName || savedName;

      if (finalName) {
        setPlayerName(finalName);
        // Sync localStorage with backend value
        if (userName) {
          localStorage.setItem('playerName', userName);
        }
        setShowNameModal(false);
        console.log('[Lobby] ✓ Using name:', finalName);
      } else {
        setShowNameModal(true);
        console.log('[Lobby] ✗ NO SAVED NAME - Showing modal');
      }
    }

    loadGames();
    loadMyActiveGames();
    loadCurrentBanner();
    loadCurrentEmbed();
    loadActiveRegistrationCard();

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
        setTicket(data.playerId, data.ticket, data.gameId);
        setJoiningGameId(null);

        // Track game joined event
        const game = games.find((g) => g.id === data.gameId);
        trackEvent({
          eventName: 'game_joined',
          properties: {
            game_id: data.gameId,
            player_id: data.playerId,
            user_name: user?.name || 'Anonymous',
            scheduled_time: game?.scheduledTime || new Date().toISOString(),
            final_player_count: game?.playerCount || 0,
          },
        });

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

  const loadActiveRegistrationCard = async () => {
    try {
      const card = await apiService.getActiveRegistrationCard();
      setCurrentRegistrationCard(card);
    } catch (error) {
      console.error('Failed to load registration card:', error);
    }
  };

  const handleJoinGame = async (game: Game) => {
    console.log('[Lobby] ===== JOIN GAME =====');
    console.log('[Lobby] Game ID:', game.id);
    console.log('[Lobby] playerName state:', playerName);
    console.log('[Lobby] Navigating to waiting lobby');

    // Navigate to waiting lobby where player will join and wait
    navigate(`/waiting-lobby/${game.id}`);
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

  const handleNameSubmit = async () => {
    console.log('[Lobby] ===== NAME SUBMIT =====');
    console.log('[Lobby] tempName:', tempName);
    if (tempName.trim()) {
      const name = tempName.trim();
      console.log('[Lobby] ✓ Saving name:', name);

      // Save to state and localStorage first (for immediate UI update)
      setPlayerName(name);
      localStorage.setItem('playerName', name);
      setShowNameModal(false);
      console.log('[Lobby] ✓ Name saved to state and localStorage');

      // Save to database (async, don't block UI)
      try {
        await apiService.updateUserProfile({ name });
        console.log('[Lobby] ✓ Name saved to database');
      } catch (error) {
        console.error('[Lobby] Failed to save name to database:', error);
        // Don't show error to user, localStorage is enough for now
      }

      // Track player registration event
      trackEvent({
        eventName: 'player_registered',
        properties: {
          user_name: name,
        },
      });
    } else {
      console.log('[Lobby] ✗ Empty name, not saving');
    }
  };

  const handleRemindMe = (gameId: string) => {
    const updated = new Set(remindedGames);
    const game = games.find((g) => g.id === gameId);

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

      // Track game interest shown
      if (game) {
        const now = new Date().getTime();
        const scheduled = new Date(game.scheduledTime).getTime();
        const minutesUntilStart = Math.max(0, Math.floor((scheduled - now) / (60 * 1000)));

        trackEvent({
          eventName: 'game_interest_shown',
          properties: {
            game_id: gameId,
            scheduled_time: game.scheduledTime,
            minutes_until_start: minutesUntilStart,
            current_player_count: game.playerCount || 0,
            full_house_prize: game.prizes.fullHouse || 0,
          },
        });
      }
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
          {timeRemaining.isExpired ? 'जल्द शुरू होगा' : `शुरू होगा: ${countdownText}`}
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
        <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }} textAlign="center">
          स्वागत है, {playerName || user?.name}!
        </Text>

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
          {/* Only show heading when there are games */}
          {games.length > 0 && (
            <Heading size={{ base: 'md', md: 'lg' }} mb={{ base: 3, md: 4 }} color="white" textAlign="center">
              उपलब्ध गेम्स
            </Heading>
          )}

          {games.length === 0 ? (
            <VStack spacing={{ base: 4, md: 6 }} w="100%">
              {currentRegistrationCard && (
                <RegistrationCard card={currentRegistrationCard} />
              )}

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
                      src={`https://www.youtube.com/embed/${currentEmbed.embedId}?autoplay=1&mute=1`}
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
                    फिलहाल कोई गेम उपलब्ध नहीं है
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
                            खिलाड़ी:
                          </Text>
                          <Text fontWeight="bold" fontSize={{ base: 'sm', md: 'md' }} color="white">{game.playerCount || 0}</Text>
                        </HStack>
                        <HStack justify="space-between" w="100%">
                          <Text fontSize={{ base: 'sm', md: 'md' }} color="grey.300">
                            सारे नंबर:
                          </Text>
                          <Text fontWeight="bold" color="highlight.500" fontSize={{ base: 'sm', md: 'md' }}>
                            {game.prizes.fullHouse || 0} अंक
                          </Text>
                        </HStack>
                      </VStack>

                      {/* Countdown Timer - Only show for LOBBY games */}
                      {game.status === 'LOBBY' && <GameCountdown scheduledTime={game.scheduledTime} />}

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
                              loadingText="फिर से शामिल हो रहे हैं..."
                              onClick={() => handleRejoinGame(game)}
                            >
                              फिर से शामिल हों
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
                              loadingText="शामिल हो रहे हैं..."
                              onClick={() => handleJoinGame(game)}
                            >
                              गेम देखें
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
                              loadingText="शामिल हो रहे हैं..."
                              onClick={() => handleJoinGame(game)}
                            >
                              गेम में शामिल हों
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
                            {isReminded ? 'रिमाइंडर सेट' : 'मुझे याद दिलाएं'}
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

        {/* Registration Card - shown when games exist */}
        {games.length > 0 && currentRegistrationCard && (
          <RegistrationCard card={currentRegistrationCard} />
        )}

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
                  src={`https://www.youtube.com/embed/${currentEmbed.embedId}?autoplay=1&mute=1`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </AspectRatio>
            </Box>
          </Box>
        )}

        {/* How to Play Section (Hindi) */}
        <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto" mt={8}>
          <Box
            p={{ base: 6, md: 8 }}
            bg="grey.800"
            borderRadius="lg"
            boxShadow="md"
            border="1px"
            borderColor="grey.700"
          >
            <Heading size={{ base: 'md', md: 'lg' }} mb={6} color="brand.500" textAlign="center">
              कैसे खेलें
            </Heading>
            <VStack align="start" spacing={4} color="grey.300" fontSize={{ base: 'sm', md: 'md' }}>
              <HStack align="start" spacing={3}>
                <Text fontWeight="bold" color="brand.400" minW="30px">1.</Text>
                <Text>गेम शुरू होने से 30 मिनट पहले "गेम में शामिल हों" बटन पर क्लिक करें।</Text>
              </HStack>
              <HStack align="start" spacing={3}>
                <Text fontWeight="bold" color="brand.400" minW="30px">2.</Text>
                <Text>आपको एक टिकट मिलेगी जिसमें 1 से 90 तक के नंबर होंगे।</Text>
              </HStack>
              <HStack align="start" spacing={3}>
                <Text fontWeight="bold" color="brand.400" minW="30px">3.</Text>
                <Text>गेम शुरू होने पर, आयोजक एक-एक करके नंबर बुलाएंगे।</Text>
              </HStack>
              <HStack align="start" spacing={3}>
                <Text fontWeight="bold" color="brand.400" minW="30px">4.</Text>
                <Text>अगर बुलाया गया नंबर आपकी टिकट पर है, तो उस पर क्लिक करके मार्क करें।</Text>
              </HStack>
              <HStack align="start" spacing={3}>
                <Text fontWeight="bold" color="brand.400" minW="30px">5.</Text>
                <Text>जब आप कोई पैटर्न पूरा कर लें (पहले पांच, ऊपर वाली लाइन, बीच वाली लाइन, नीचे वाली लाइन, या सारे नंबर), तो "जीत का दावा करें" बटन दबाएं।</Text>
              </HStack>
              <HStack align="start" spacing={3}>
                <Text fontWeight="bold" color="brand.400" minW="30px">6.</Text>
                <Text>सबसे पहले दावा करने वाले को इनाम मिलेगा!</Text>
              </HStack>
              <Box mt={4} p={4} bg="grey.900" borderRadius="md" borderLeft="4px" borderColor="brand.500">
                <Text fontWeight="semibold" color="brand.400" mb={2}>इनाम के पैटर्न:</Text>
                <VStack align="start" spacing={1} fontSize="sm">
                  <Text>• <strong>पहले पांच:</strong> टिकट पर कोई भी 5 नंबर</Text>
                  <Text>• <strong>ऊपर वाली लाइन:</strong> पहली लाइन के सभी नंबर</Text>
                  <Text>• <strong>बीच वाली लाइन:</strong> बीच की लाइन के सभी नंबर</Text>
                  <Text>• <strong>नीचे वाली लाइन:</strong> आखिरी लाइन के सभी नंबर</Text>
                  <Text>• <strong>सारे नंबर:</strong> टिकट के सभी नंबर</Text>
                </VStack>
              </Box>
            </VStack>
          </Box>
        </Box>

        {/* Terms and Conditions Section */}
        <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto" mb={8}>
          <Box
            p={{ base: 6, md: 8 }}
            bg="grey.800"
            borderRadius="lg"
            boxShadow="md"
            border="1px"
            borderColor="grey.700"
          >
            <Heading size={{ base: 'md', md: 'lg' }} mb={6} color="brand.500" textAlign="center">
              Terms & Conditions
            </Heading>
            <VStack align="start" spacing={4} color="grey.400" fontSize={{ base: 'xs', md: 'sm' }}>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>1. Eligibility</Text>
                <Text>Players must be 18 years or older to participate. By joining, you confirm that you meet this requirement and agree to these terms.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>2. Game Rules</Text>
                <Text>All decisions made by the organizer are final. Players must follow the game rules and mark numbers honestly. Any form of cheating or manipulation will result in immediate disqualification.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>3. Prize Distribution</Text>
                <Text>Prizes will be awarded as announced at the start of the game. The organizer reserves the right to verify claims before awarding prizes. Winners must claim their prizes within the specified time period.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>4. Technical Issues</Text>
                <Text>The organizer is not responsible for technical issues, internet connectivity problems, or device malfunctions that may affect gameplay. Players participate at their own risk.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>5. Fair Play</Text>
                <Text>This platform is for entertainment purposes. Multiple accounts, bots, or automated scripts are strictly prohibited. Violation will result in permanent ban.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>6. Refunds</Text>
                <Text>Entry fees (if applicable) are non-refundable once the game has started. Refunds may be considered only in case of game cancellation by the organizer.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>7. Privacy</Text>
                <Text>Your personal information will be kept confidential and used only for game-related purposes. We do not share your data with third parties without consent.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>8. Dispute Resolution</Text>
                <Text>Any disputes arising from the game will be resolved by the organizer. The organizer's decision in all matters relating to the game is final and binding.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>9. Modifications</Text>
                <Text>The organizer reserves the right to modify these terms and conditions at any time. Continued participation constitutes acceptance of any changes.</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="grey.300" mb={2}>10. Liability</Text>
                <Text>The organizer shall not be held liable for any losses, damages, or claims arising from participation in the game. Players participate voluntarily and at their own risk.</Text>
              </Box>
              <Box mt={4} p={3} bg="grey.900" borderRadius="md" borderLeft="3px" borderColor="red.500">
                <Text fontSize="xs" color="grey.500">
                  By participating in this game, you acknowledge that you have read, understood, and agree to be bound by these terms and conditions. If you do not agree, please do not participate.
                </Text>
              </Box>
            </VStack>
          </Box>
        </Box>
      </VStack>

      {/* Name Input Modal */}
      <Modal isOpen={showNameModal} onClose={() => {}} closeOnOverlayClick={false} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent
          mx={4}
          bg="grey.700"
          position="relative"
          overflow="visible"
          sx={{
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '-4px',
              borderRadius: 'md',
              padding: '4px',
              background: 'linear-gradient(90deg, #FFD700, #00FF00, #00FFFF, #FF00FF, #FFD700)',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'rotateBorder 3s linear infinite, pulseBorder 1.5s ease-in-out infinite',
              backgroundSize: '300% 100%',
              zIndex: -1,
            },
            '@keyframes rotateBorder': {
              '0%': {
                backgroundPosition: '0% 0%',
              },
              '100%': {
                backgroundPosition: '300% 0%',
              },
            },
            '@keyframes pulseBorder': {
              '0%, 100%': {
                filter: 'brightness(1) drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))',
              },
              '50%': {
                filter: 'brightness(1.5) drop-shadow(0 0 20px rgba(0, 255, 0, 0.8))',
              },
            },
          }}
          boxShadow="0 0 30px 5px rgba(0, 255, 0, 0.3), 0 0 60px 10px rgba(255, 215, 0, 0.2)"
        >
          <ModalHeader
            color="white"
            fontSize="lg"
            fontWeight="bold"
            pb={2}
            textAlign="center"
          >
            इस SUNDAY के TAMBOLA में iPhone जीतने के लिए अपना नाम दर्ज करें
          </ModalHeader>
          <ModalBody pb={6}>
            <FormControl>
              <Input
                placeholder="नाम लिखें"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleNameSubmit();
                  }
                }}
                autoFocus
                color="white"
                bg="rgba(255, 255, 255, 0.1)"
                borderColor="rgba(255, 255, 255, 0.3)"
                borderWidth="2px"
                _placeholder={{ color: 'rgba(255, 255, 255, 0.5)' }}
                _hover={{
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  bg: 'rgba(255, 255, 255, 0.15)'
                }}
                _focus={{
                  borderColor: '#FFD700',
                  boxShadow: '0 0 0 1px #FFD700, 0 0 15px rgba(255, 215, 0, 0.3)',
                  bg: 'rgba(255, 255, 255, 0.15)'
                }}
                fontSize="md"
                fontWeight="medium"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={handleNameSubmit}
              isDisabled={!tempName.trim()}
              w="100%"
              size="lg"
              bg="brand.500"
              color="white"
              fontWeight="bold"
              fontSize="lg"
              _hover={{
                bg: 'brand.600',
                transform: 'scale(1.02)',
                boxShadow: '0 0 20px rgba(37, 141, 88, 0.6)',
              }}
              _active={{
                bg: 'brand.700',
                transform: 'scale(0.98)',
              }}
              _disabled={{
                bg: 'grey.600',
                color: 'grey.400',
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
              transition="all 0.2s"
              boxShadow="0 4px 15px rgba(37, 141, 88, 0.4)"
            >
              जारी रखें
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
