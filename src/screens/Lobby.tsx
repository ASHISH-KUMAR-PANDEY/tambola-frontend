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
  Flex,
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
// Logo import removed - not used in new design
import { RegistrationCard } from '../components/RegistrationCard';
import { ExitIntentPopup } from '../components/ExitIntentPopup';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useTambolaTracking } from '../hooks/useTambolaTracking';

// Sunday Countdown Timer Component
const SundayCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const getNextSunday = () => {
      const now = new Date();
      const day = now.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(20, 0, 0, 0); // 8 PM Sunday
      if (nextSunday <= now) {
        nextSunday.setDate(nextSunday.getDate() + 7);
      }
      return nextSunday;
    };

    const update = () => {
      const now = new Date();
      const target = getNextSunday();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const TimeBlock = ({ value, label }: { value: string; label: string }) => (
    <VStack spacing={0}>
      <Text fontSize="2xl" fontWeight="extrabold" color="white" lineHeight="1.1">
        {value}
      </Text>
      <Text fontSize="8px" color="rgba(255,255,255,0.6)" textTransform="uppercase" letterSpacing="0.5px">
        {label}
      </Text>
    </VStack>
  );

  return (
    <VStack spacing={1} mt={2}>
      <Box
        bg="linear-gradient(135deg, #C85A2A, #B34A1E)"
        px={3}
        py={0.5}
        borderRadius="full"
        mb={-1}
        zIndex={1}
      >
        <Text fontSize="9px" fontWeight="bold" color="white" letterSpacing="0.5px">
          शेष समय
        </Text>
      </Box>
      <Flex
        bg="rgba(0, 0, 0, 0.1)"
        borderRadius="20px"
        border="1px solid rgba(255,255,255,0.1)"
        px={5}
        py={2.5}
        align="center"
        gap={3}
      >
        <TimeBlock value={pad(timeLeft.days)} label="दिन" />
        <Text fontSize="xl" fontWeight="bold" color="rgba(255,255,255,0.4)" mt={-2}>:</Text>
        <TimeBlock value={pad(timeLeft.hours)} label="घंटे" />
        <Text fontSize="xl" fontWeight="bold" color="rgba(255,255,255,0.4)" mt={-2}>:</Text>
        <TimeBlock value={pad(timeLeft.minutes)} label="मिनट" />
        <Text fontSize="xl" fontWeight="bold" color="rgba(255,255,255,0.4)" mt={-2}>:</Text>
        <TimeBlock value={pad(timeLeft.seconds)} label="सेकंड" />
      </Flex>
    </VStack>
  );
};

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
  const [pendingGameToJoin, setPendingGameToJoin] = useState<Game | null>(null);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [registrationReminderSet, setRegistrationReminderSet] = useState<boolean>(() => {
    // Check if reminder is already set for current registration card
    // We'll update this when we load the registration card
    return false;
  });
  const [isVipVerified, setIsVipVerified] = useState<boolean>(() => {
    // Check if VIP status was already verified in this session
    return localStorage.getItem('vip_verified') === 'true';
  });
  const [activeTab, setActiveTab] = useState<'live' | 'ravivar'>(() => new Date().getDay() === 0 ? 'ravivar' : 'live');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isSundayRegistered, setIsSundayRegistered] = useState<boolean>(() => {
    return localStorage.getItem('sunday_tambola_registered') === 'true';
  });
  const [showTerms, setShowTerms] = useState(false);

  // Initialize playerName from localStorage or backend on mount
  useEffect(() => {
    // Helper function to check if name is in default format
    const isDefaultName = (name: string | null | undefined): boolean => {
      if (!name) return true;
      // Check if name matches pattern: "User {userId}" or "user_{userId}@app.com"
      return name.startsWith('User ') || name.startsWith('user_');
    };

    console.log('[Lobby] ===== INIT NAME CHECK =====');
    console.log('[Lobby] User role:', user?.role);
    console.log('[Lobby] User name:', user?.name);
    console.log('[Lobby] localStorage playerName:', localStorage.getItem('playerName'));

    // Check name from: 1) user object (from backend), 2) localStorage
    const userName = user?.name;
    const savedName = localStorage.getItem('playerName');

    // Priority: backend userName > localStorage
    const finalName = userName || savedName;

    if (finalName && !isDefaultName(finalName)) {
      setPlayerName(finalName);
      // Sync localStorage with backend value
      if (userName && !isDefaultName(userName)) {
        localStorage.setItem('playerName', userName);
      }
      console.log('[Lobby] ✓ Using name:', finalName);
    } else {
      console.log('[Lobby] No valid name found, will ask when joining game');
    }
  }, [user?.name, user?.role]); // Re-run when user name or role changes

  // Separate effect for initialization
  useEffect(() => {
    loadGames();
    loadMyActiveGames();
    loadCurrentBanner();
    loadCurrentEmbed();
    loadActiveRegistrationCard();

    // Setup WebSocket event handlers
    wsService.on({
      onConnected: () => {
        setConnected(true);
      },
      onDisconnected: () => {
        setConnected(false);
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
        // Special handling for VIP-only access
        if (error.code === 'VIP_ONLY') {
          toast({
            title: 'VIP सदस्यता आवश्यक',
            description: error.message || 'यह गेम केवल STAGE-VIP सदस्यों के लिए है, शामिल होने के लिए STAGE के VIP सदस्य बनें।',
            status: 'warning',
            duration: 10000,
            isClosable: true,
          });
        }
        // Special handling for game not found (deleted game)
        else if (error.code === 'GAME_NOT_FOUND') {
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
    } catch (error: any) {
      console.error('Failed to load games:', error);
      setGames([]);

      // NOTE: Everyone can see games now. VIP check happens when joining.
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

      // Check if reminder is already set for this card
      if (card) {
        const key = `reminder_${card.id}`;
        const registeredAtStr = localStorage.getItem(key);
        if (registeredAtStr) {
          const registeredAt = new Date(registeredAtStr);
          const lastResetAt = new Date(card.lastResetAt);
          setRegistrationReminderSet(registeredAt > lastResetAt);
        }
      }
    } catch (error) {
      console.error('Failed to load registration card:', error);
    }
  };

  // Exit intent popup - history manipulation for back button
  useEffect(() => {
    // Only set up if there's a registration card and reminder is not set
    if (!currentRegistrationCard || registrationReminderSet) return;

    // Push a dummy state to trap the back button
    window.history.pushState({ exitIntent: true }, '');

    const handlePopState = () => {
      // Only show popup if reminder is not set
      if (!registrationReminderSet && currentRegistrationCard) {
        // Show the popup
        setShowExitPopup(true);
        // Push state again to keep trapping
        window.history.pushState({ exitIntent: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentRegistrationCard, registrationReminderSet]);

  const handleExitPopupClose = () => {
    setShowExitPopup(false);
    // Go back to actually navigate away
    window.history.back();
  };

  const handleExitPopupRegister = () => {
    setRegistrationReminderSet(true);
    // Popup will auto-close after success animation
  };

  const handleJoinGame = async (game: Game) => {
    console.log('[Lobby] ===== JOIN GAME =====');
    console.log('[Lobby] Game ID:', game.id);
    console.log('[Lobby] Game Status:', game.status);
    console.log('[Lobby] playerName state:', playerName);

    // STEP 1: Check VIP status (only if not already verified)
    if (!isVipVerified) {
      console.log('[Lobby] Checking VIP status...');
      try {
        const isVIP = await apiService.checkVipStatus();
        console.log('[Lobby] VIP status:', isVIP);
        if (!isVIP) {
          toast({
            title: 'VIP सदस्यता आवश्यक',
            description: 'आप STAGE के VIP member नहीं हैं',
            status: 'warning',
            duration: 5000,
          });
          return;
        }
        // Cache VIP status
        setIsVipVerified(true);
        localStorage.setItem('vip_verified', 'true');
        console.log('[Lobby] VIP verified and cached');
      } catch (error) {
        console.error('[Lobby] VIP check failed:', error);
        // Fail closed - block join on error (including auth failures)
        toast({
          title: 'VIP सदस्यता आवश्यक',
          description: 'आप STAGE के VIP member नहीं हैं',
          status: 'warning',
          duration: 5000,
        });
        return;
      }
    } else {
      console.log('[Lobby] VIP already verified (cached)');
    }

    // STEP 2: Helper function to check if name is valid
    const isValidName = (name: string | null | undefined): boolean => {
      if (!name) return false;
      // Check if name matches default pattern
      return !(name.startsWith('User ') || name.startsWith('user_'));
    };

    const currentName = playerName || localStorage.getItem('playerName') || user?.name;

    // If no valid name, show modal first
    if (!isValidName(currentName)) {
      console.log('[Lobby] No valid name - showing modal first');
      setPendingGameToJoin(game);
      setShowNameModal(true);
      return;
    }

    // Proceed with joining game
    await proceedWithJoinGame(game, currentName!);
  };

  const proceedWithJoinGame = async (game: Game, userName: string) => {
    console.log('[Lobby] Proceeding to join game with name:', userName);
    setJoiningGameId(game.id);

    // Ensure WebSocket is connected
    if (!wsService.isConnected()) {
      wsService.connect(user!.id);
      // Wait for connection
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (wsService.isConnected()) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 5000);
      });
    }

    console.log('[Lobby] Calling joinGame');
    // Join game (backend handles both LOBBY and ACTIVE status)
    wsService.joinGame(game.id, userName);
    // onGameJoined handler will navigate to /game/{gameId}
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
      setTempName(''); // Clear temp name
      console.log('[Lobby] ✓ Name saved to state and localStorage');

      // Save to database and update authStore
      try {
        const response = await apiService.updateUserProfile({ name });
        console.log('[Lobby] ✓ Name saved to database');

        // Update user object in authStore with the updated user from API
        if (response.user && user) {
          const updatedUser = { ...user, name: response.user.name };
          useAuthStore.getState().setUser(updatedUser);
          console.log('[Lobby] ✓ User object updated in authStore');
        }
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

      // If there's a pending game to join, proceed with joining it
      if (pendingGameToJoin) {
        console.log('[Lobby] ✓ Proceeding to join pending game:', pendingGameToJoin.id);
        const gameToJoin = pendingGameToJoin;
        setPendingGameToJoin(null);
        await proceedWithJoinGame(gameToJoin, name);
      }
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
      <Center
        h="100vh"
        bg="#351947"
        backgroundImage="url('/lobby-bg.svg')"
        backgroundSize="cover"
        backgroundPosition="center"
      >
        <Spinner size="xl" color="#38FF99" thickness="4px" />
      </Center>
    );
  }

  return (
    <Box
      w="100vw"
      minH="100vh"
      bg="#351947"
      backgroundImage="url('/lobby-bg.svg')"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundAttachment="fixed"
      position="relative"
      overflow="hidden"
    >

      <VStack
        spacing={0}
        w="100%"
        maxW="480px"
        mx="auto"
        align="stretch"
        position="relative"
        zIndex={1}
        px={4}
        pt={4}
        pb={0}
        h="100dvh"
      >
        {/* Organizer Controls - Always show for organizers */}
        {(user?.email === 'organizer@test.com' || user?.role === 'ORGANIZER') && (
          <HStack spacing={2} justify="center" w="100%" flexWrap="wrap" mb={3}>
            <Button
              colorScheme="brand"
              onClick={() => navigate('/organizer')}
              size="sm"
              variant="solid"
            >
              Create Game
            </Button>
            <Button
              colorScheme="purple"
              onClick={() => navigate('/banner-management')}
              size="sm"
              variant="solid"
            >
              Manage Banner
            </Button>
            <Button
              colorScheme="teal"
              onClick={() => navigate('/cohort-management')}
              size="sm"
              variant="solid"
            >
              Manage Cohort
            </Button>
            <Button
              variant="outline"
              colorScheme="red"
              onClick={handleLogout}
              size="sm"
            >
              Logout
            </Button>
          </HStack>
        )}

        {/* Tab Bar */}
        <Flex
          bg="rgba(0, 0, 0, 0.35)"
          borderRadius="27px"
          h="54px"
          w="302px"
          mx="auto"
          mb={6}
          position="relative"
          align="center"
          px="10px"
          gap={0}
          border="1px solid rgba(255, 255, 255, 0.15)"
          border="1px solid rgba(255, 255, 255, 0.15)"
        >
          {/* Live Tambola Tab */}
          <Flex
            justify="center"
            align="center"
            borderRadius="17px"
            cursor="pointer"
            onClick={() => setActiveTab('live')}
            bg={activeTab === 'live' ? 'linear-gradient(to right, #B31232, #FF6B2C)' : 'transparent'}
            transition="all 0.3s"
            gap={2}
            h="34px"
            px={4}
            flex={activeTab === 'live' ? '0 0 129px' : '1'}
            sx={activeTab === 'live' ? { backdropFilter: 'blur(9px)' } : {}}
          >
            <Box w="8px" h="8px" borderRadius="full" bg="#39DE8A" flexShrink={0} />
            <Text
              fontSize="13px"
              fontWeight="bold"
              color="white"
              whiteSpace="nowrap"
            >
              लाइव तम्बोला
            </Text>
          </Flex>

          {/* Ravivar Tambola Tab */}
          <Flex
            justify="center"
            align="center"
            borderRadius="17px"
            cursor="pointer"
            onClick={() => setActiveTab('ravivar')}
            bg={activeTab === 'ravivar' ? 'linear-gradient(to right, #B31232, #FF6B2C)' : 'transparent'}
            transition="all 0.3s"
            gap={2}
            h="34px"
            px={4}
            flex={activeTab === 'ravivar' ? '0 0 147px' : '1'}
            sx={activeTab === 'ravivar' ? { backdropFilter: 'blur(9px)' } : {}}
          >
            <Image src="/calendar-icon.svg" alt="" w="18px" h="18px" flexShrink={0} />
            <Text fontSize="13px" color="white" whiteSpace="nowrap">रविवार तम्बोला</Text>
          </Flex>
        </Flex>

        {/* Main content - centered */}
        <Flex flex={1} direction="column" align="center" justify="center" minH={0}>
          <Box position="relative">
            {/* Glowing rays behind badge */}
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              w="120vw"
              h="120vw"
              pointerEvents="none"
              sx={{
                '@keyframes rayGlow': {
                  '0%, 100%': { opacity: 0.15, transform: 'translate(-50%, -50%) scale(1) rotate(0deg)' },
                  '33%': { opacity: 0.35, transform: 'translate(-50%, -50%) scale(1.05) rotate(2deg)' },
                  '66%': { opacity: 0.2, transform: 'translate(-50%, -50%) scale(0.98) rotate(-1deg)' },
                },
                '@keyframes rayGlow2': {
                  '0%, 100%': { opacity: 0.2, transform: 'translate(-50%, -50%) scale(1.02) rotate(0deg)' },
                  '50%': { opacity: 0.4, transform: 'translate(-50%, -50%) scale(1.08) rotate(-2deg)' },
                },
                background: `
                  conic-gradient(
                    from 0deg at 50% 50%,
                    transparent 0deg,
                    rgba(200, 220, 255, 0.3) 5deg,
                    transparent 10deg,
                    transparent 20deg,
                    rgba(200, 220, 255, 0.25) 25deg,
                    transparent 30deg,
                    transparent 40deg,
                    rgba(200, 220, 255, 0.3) 45deg,
                    transparent 50deg,
                    transparent 60deg,
                    rgba(200, 220, 255, 0.25) 65deg,
                    transparent 70deg,
                    transparent 80deg,
                    rgba(200, 220, 255, 0.3) 85deg,
                    transparent 90deg,
                    transparent 100deg,
                    rgba(200, 220, 255, 0.25) 105deg,
                    transparent 110deg,
                    transparent 120deg,
                    rgba(200, 220, 255, 0.3) 125deg,
                    transparent 130deg,
                    transparent 140deg,
                    rgba(200, 220, 255, 0.25) 145deg,
                    transparent 150deg,
                    transparent 160deg,
                    rgba(200, 220, 255, 0.3) 165deg,
                    transparent 170deg,
                    transparent 180deg,
                    rgba(200, 220, 255, 0.25) 185deg,
                    transparent 190deg,
                    transparent 200deg,
                    rgba(200, 220, 255, 0.3) 205deg,
                    transparent 210deg,
                    transparent 220deg,
                    rgba(200, 220, 255, 0.25) 225deg,
                    transparent 230deg,
                    transparent 240deg,
                    rgba(200, 220, 255, 0.3) 245deg,
                    transparent 250deg,
                    transparent 260deg,
                    rgba(200, 220, 255, 0.25) 265deg,
                    transparent 270deg,
                    transparent 280deg,
                    rgba(200, 220, 255, 0.3) 285deg,
                    transparent 290deg,
                    transparent 300deg,
                    rgba(200, 220, 255, 0.25) 305deg,
                    transparent 310deg,
                    transparent 320deg,
                    rgba(200, 220, 255, 0.3) 325deg,
                    transparent 330deg,
                    transparent 340deg,
                    rgba(200, 220, 255, 0.25) 345deg,
                    transparent 350deg,
                    transparent 360deg
                  )
                `,
                animation: 'rayGlow 3s ease-in-out infinite',
                filter: 'blur(8px)',
              }}
            />
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              w="100vw"
              h="100vw"
              pointerEvents="none"
              borderRadius="full"
              sx={{
                background: 'radial-gradient(ellipse at center, rgba(220, 230, 255, 0.2) 0%, rgba(200, 215, 255, 0.1) 40%, transparent 70%)',
                animation: 'rayGlow2 2s ease-in-out infinite',
                filter: 'blur(15px)',
              }}
            />
            <Image src={activeTab === 'live' ? '/livebadge.svg' : '/sundaybadge.svg'} alt="TAMBOLA" w="360px" position="relative" zIndex={1} />
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              pointerEvents="none"
              sx={{
                '@keyframes bulbBlink': {
                  '0%, 100%': { opacity: 0 },
                  '50%': { opacity: 0.6 },
                },
                '@keyframes bulbBlink2': {
                  '0%, 100%': { opacity: 0.6 },
                  '50%': { opacity: 0 },
                },
                '&::before, &::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  top: 0,
                  left: 0,
                  borderRadius: 'inherit',
                  pointerEvents: 'none',
                },
                '&::before': {
                  background: 'radial-gradient(circle at 8% 50%, rgba(255,220,100,0.5) 0%, transparent 4%), radial-gradient(circle at 92% 50%, rgba(255,220,100,0.5) 0%, transparent 4%), radial-gradient(circle at 15% 30%, rgba(255,220,100,0.4) 0%, transparent 3%), radial-gradient(circle at 85% 30%, rgba(255,220,100,0.4) 0%, transparent 3%), radial-gradient(circle at 15% 70%, rgba(255,220,100,0.4) 0%, transparent 3%), radial-gradient(circle at 85% 70%, rgba(255,220,100,0.4) 0%, transparent 3%)',
                  animation: 'bulbBlink 1.5s ease-in-out infinite',
                },
                '&::after': {
                  background: 'radial-gradient(circle at 10% 40%, rgba(255,220,100,0.4) 0%, transparent 3.5%), radial-gradient(circle at 90% 40%, rgba(255,220,100,0.4) 0%, transparent 3.5%), radial-gradient(circle at 10% 60%, rgba(255,220,100,0.4) 0%, transparent 3.5%), radial-gradient(circle at 90% 60%, rgba(255,220,100,0.4) 0%, transparent 3.5%)',
                  animation: 'bulbBlink2 1.5s ease-in-out infinite',
                },
              }}
            />
          </Box>

          {/* Sunday Countdown Timer - only on ravivar tab */}
          {activeTab === 'ravivar' && (
            <SundayCountdown />
          )}

          <Box
            as="button"
            w="80%"
            maxW="300px"
            mt={3}
            cursor="pointer"
            transition="transform 0.15s"
            _hover={{ transform: 'scale(1.02)' }}
            _active={{ transform: 'scale(0.98)' }}
            onClick={() => {
              // Haptic feedback on tap
              if (navigator.vibrate) {
                navigator.vibrate(50);
              }
              if (activeTab === 'ravivar') {
                // Toggle registration for Sunday Tambola
                const newState = !isSundayRegistered;
                setIsSundayRegistered(newState);
                localStorage.setItem('sunday_tambola_registered', newState ? 'true' : 'false');
                return;
              }
              if (games.length > 0) {
                const joinableGame = games.find(g => canJoinGame(g.scheduledTime) || g.status === 'ACTIVE');
                if (joinableGame) {
                  handleJoinGame(joinableGame);
                } else {
                  navigate('/game-preview');
                }
              } else {
                navigate('/game-preview');
              }
            }}
          >
            {activeTab === 'live' ? (
              <Image src="/abhikheleCTA.svg" alt="अभी खेलें" w="100%" />
            ) : isSundayRegistered ? (
              <Image src="/registeredstate.svg" alt="आप रजिस्टर हो चुके हैं" w="100%" />
            ) : (
              <Image src="/registercta.svg" alt="रजिस्टर करें" w="100%" />
            )}
          </Box>
        </Flex>

        {/* Bottom CTAs */}
        <HStack spacing={3} justify="center" pb={6} flexShrink={0}>
          <Image src="/kaisekhele.svg" alt="कैसे खेलें" cursor="pointer" h="26px" onClick={() => setShowHowToPlay(true)} />
          <Image src="/niyamsharte.svg" alt="नियम और शर्तें" cursor="pointer" h="26px" onClick={() => setShowTerms(true)} />
        </HStack>
      </VStack>

      {/* Kaise Khele Bottom Sheet */}
      {showHowToPlay && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1000}
        >
          {/* Backdrop */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.600"
            onClick={() => setShowHowToPlay(false)}
          />
          {/* Sheet */}
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            maxH="85vh"
            overflowY="auto"
            sx={{
              animation: 'slideUp 0.3s ease-out',
              '@keyframes slideUp': {
                from: { transform: 'translateY(100%)' },
                to: { transform: 'translateY(0)' },
              },
              '@keyframes slideDown': {
                from: { transform: 'translateY(0)' },
                to: { transform: 'translateY(100%)' },
              },
              touchAction: 'none',
            }}
            onTouchStart={(e: React.TouchEvent) => {
              const sheet = e.currentTarget;
              const startY = e.touches[0].clientY;
              let currentY = startY;

              const onMove = (ev: TouchEvent) => {
                currentY = ev.touches[0].clientY;
                const diff = currentY - startY;
                if (diff > 0) {
                  sheet.style.transform = `translateY(${diff}px)`;
                }
              };

              const onEnd = () => {
                const diff = currentY - startY;
                if (diff > 100) {
                  sheet.style.animation = 'slideDown 0.2s ease-in forwards';
                  setTimeout(() => setShowHowToPlay(false), 200);
                } else {
                  sheet.style.transform = 'translateY(0)';
                  sheet.style.transition = 'transform 0.2s ease-out';
                  setTimeout(() => { sheet.style.transition = ''; }, 200);
                }
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
              };

              document.addEventListener('touchmove', onMove, { passive: false });
              document.addEventListener('touchend', onEnd);
            }}
          >
            {/* Bottom sheet SVG with built-in close icon */}
            <Box position="relative" maxW="412px" mx="auto">
              <Image
                src={activeTab === 'ravivar' ? '/rkaisekhele.svg' : '/bottomsheet-kaisekhele.svg'}
                alt="कैसे खेलें"
                w="100%"
                display="block"
              />
              {/* Invisible tap area over the SVG's close icon (top-right) */}
              <Box
                position="absolute"
                top="8px"
                right="8px"
                w="40px"
                h="40px"
                cursor="pointer"
                onClick={() => setShowHowToPlay(false)}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* नियम और शर्तें Bottom Sheet */}
      {showTerms && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1000}
        >
          {/* Backdrop */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.600"
            onClick={() => setShowTerms(false)}
          />
          {/* Sheet */}
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            maxH="85vh"
            overflowY="auto"
            sx={{
              animation: 'slideUp 0.3s ease-out',
              '@keyframes slideUp': {
                from: { transform: 'translateY(100%)' },
                to: { transform: 'translateY(0)' },
              },
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              touchAction: 'pan-y',
            }}
          >
            <Box position="relative" maxW="412px" mx="auto">
              <Image
                src="/tnc.svg"
                alt="नियम और शर्तें"
                w="100%"
                display="block"
              />
              {/* Invisible tap area over the SVG's close icon (top-right) */}
              <Box
                position="absolute"
                top="8px"
                right="8px"
                w="40px"
                h="40px"
                cursor="pointer"
                onClick={() => setShowTerms(false)}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Name Input Modal */}
      <Modal isOpen={showNameModal} onClose={() => {}} closeOnOverlayClick={false} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent
          mx={4}
          bg="#2D1540"
          borderRadius="20px"
          position="relative"
          overflow="visible"
          border="2px solid rgba(212, 168, 67, 0.3)"
          boxShadow="0 0 40px rgba(53, 25, 71, 0.8), 0 0 80px rgba(212, 168, 67, 0.15)"
          sx={{
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '-4px',
              borderRadius: '22px',
              padding: '4px',
              background: 'linear-gradient(90deg, #FFD700, #38FF99, #FFD700)',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'rotateBorder 3s linear infinite',
              backgroundSize: '300% 100%',
              zIndex: -1,
            },
            '@keyframes rotateBorder': {
              '0%': { backgroundPosition: '0% 0%' },
              '100%': { backgroundPosition: '300% 0%' },
            },
          }}
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
                bg="rgba(255, 255, 255, 0.08)"
                borderColor="rgba(255, 255, 255, 0.2)"
                borderWidth="2px"
                borderRadius="12px"
                _placeholder={{ color: 'rgba(255, 255, 255, 0.4)' }}
                _hover={{
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                  bg: 'rgba(255, 255, 255, 0.12)'
                }}
                _focus={{
                  borderColor: '#38FF99',
                  boxShadow: '0 0 0 1px #38FF99, 0 0 15px rgba(56, 255, 153, 0.2)',
                  bg: 'rgba(255, 255, 255, 0.12)'
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
              bg="linear-gradient(135deg, #C41230 0%, #9B0624 100%)"
              color="white"
              fontWeight="bold"
              fontSize="lg"
              borderRadius="12px"
              _hover={{
                bg: 'linear-gradient(135deg, #D41840 0%, #AB1634 100%)',
                transform: 'scale(1.02)',
                boxShadow: '0 0 20px rgba(156, 6, 36, 0.5)',
              }}
              _active={{
                transform: 'scale(0.98)',
              }}
              _disabled={{
                bg: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)',
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
              transition="all 0.2s"
              boxShadow="0 4px 15px rgba(156, 6, 36, 0.4)"
            >
              जारी रखें
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Exit Intent Popup */}
      {currentRegistrationCard && (
        <ExitIntentPopup
          isOpen={showExitPopup}
          cardId={currentRegistrationCard.id}
          onClose={handleExitPopupClose}
          onRegister={handleExitPopupRegister}
        />
      )}
    </Box>
  );
}
