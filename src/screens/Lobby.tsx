import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
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
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Icon,
} from '@chakra-ui/react';
import { BellIcon } from '@chakra-ui/icons';
import { apiService, type Game, type PromotionalBanner, type YouTubeEmbed, type YouTubeLiveStream, type RegistrationCard as RegistrationCardType } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
import { Logo } from '../components/Logo';
import { RegistrationCard } from '../components/RegistrationCard';
import { SoloGameCTA } from '../components/solo/SoloGameCTA';
import { ExitIntentPopup } from '../components/ExitIntentPopup';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { sendToFlutter } from '../utils/flutterBridge';
import { ensureYTAPI } from '../hooks/useYouTubePlayer';

export default function Lobby() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuthStore();
  const { setCurrentGame, setTicket, restoreGameState } = useGameStore();
  const { setConnected } = useUIStore();
  const { trackEvent } = useTambolaTracking();
  const isFlutterApp = !!localStorage.getItem('app_user_id');

  // Preload YouTube IFrame API so it's cached when user enters Solo Game
  useEffect(() => { ensureYTAPI(); }, []);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'sunday'>('all');

  const [games, setGames] = useState<Game[]>([]);
  const [myActiveGames, setMyActiveGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState<PromotionalBanner | null>(null);
  const [currentEmbed, setCurrentEmbed] = useState<YouTubeEmbed | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const [currentRegistrationCard, setCurrentRegistrationCard] = useState<RegistrationCardType | null>(null);
  const [currentLiveStream, setCurrentLiveStream] = useState<YouTubeLiveStream | null>(null);
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
    loadCurrentLiveStream();
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
      setGames(validGames.filter((g) => (g.status === 'LOBBY' || g.status === 'ACTIVE') && (g as any).gameMode !== 'WEEKLY'));
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

  const loadCurrentLiveStream = async () => {
    try {
      const stream = await apiService.getCurrentYouTubeLiveStream();
      setCurrentLiveStream(stream);
    } catch (error) {
      console.error('Failed to load live stream:', error);
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

  const handleRefresh = () => {
    setIsLoading(true);
    loadGames();
    toast({
      title: 'रिफ्रेश हो गया',
      status: 'success',
      duration: 1000,
    });
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
      <Center h="100vh" w="100vw">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bgGradient="linear(to-t, #2B080C, #0E0028)">
      <VStack spacing={{ base: 4, md: 6 }} w="100%" align="stretch" p={{ base: 3, md: 4 }}>
        {/* Header — ← back | Stage logo centered | refresh → */}
        <HStack w="100%" justify="space-between" align="center" pt={{ base: 1, md: 2 }}>
          <Box
            as="button"
            onClick={() => {
              if (isFlutterApp) {
                if ((window as any).FlutterChannel?.postMessage) {
                  sendToFlutter('backPressed');
                } else {
                  window.location.href = 'stage://har/hin';
                }
              } else {
                handleLogout();
              }
            }}
            p={1}
            cursor="pointer"
            w="24px"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Box>
          <Logo height={{ base: '26px', md: '30px' }} />
          <Box as="button" onClick={handleRefresh} p={1} cursor="pointer" w="24px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </Box>
        </HStack>

        {/* Tab Navigation — glassmorphic pill bar from glassbg.svg */}
        <HStack
          w="100%"
          maxW={{ base: '100%', md: '600px' }}
          mx="auto"
          bg="rgba(255,255,255,0.08)"
          border="1px solid rgba(255,255,255,0.22)"
          borderRadius="full"
          h={{ base: '44px', md: '54px' }}
          p={{ base: '4px', md: '5px' }}
          spacing={0}
          justify="center"
          css={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* All tab */}
          <Box
            as="button"
            flex={1}
            h="100%"
            borderRadius="full"
            bg={activeTab === 'all' ? 'white' : 'transparent'}
            boxShadow={activeTab === 'all' ? '0 0 12px 4px rgba(255,255,255,0.25), 0 0 24px 8px rgba(255,255,255,0.1)' : 'none'}
            css={activeTab === 'all' ? {
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } : undefined}
            color={activeTab === 'all' ? '#313131' : '#E1E1E1'}
            fontWeight={activeTab === 'all' ? '600' : '500'}
            fontSize={{ base: '13px', md: '14px' }}
            transition="all 0.25s ease"
            onClick={() => setActiveTab('all')}
            display="flex"
            alignItems="center"
            justifyContent="center"
            whiteSpace="nowrap"
          >
            सभी
          </Box>
          {/* Live tab */}
          <Box
            as="button"
            flex={1}
            h="100%"
            borderRadius="full"
            bg={activeTab === 'live' ? 'white' : 'transparent'}
            boxShadow={activeTab === 'live' ? '0 0 12px 4px rgba(255,255,255,0.25), 0 0 24px 8px rgba(255,255,255,0.1)' : 'none'}
            css={activeTab === 'live' ? {
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } : undefined}
            color={activeTab === 'live' ? '#313131' : '#E1E1E1'}
            fontWeight={activeTab === 'live' ? '600' : '500'}
            fontSize={{ base: '13px', md: '14px' }}
            transition="all 0.25s ease"
            onClick={() => setActiveTab('live')}
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap="6px"
            whiteSpace="nowrap"
          >
            <Box w="8px" h="8px" borderRadius="full" bg="#41EE96" flexShrink={0} />
            लाइव गेम
          </Box>
          {/* Coming Sunday tab */}
          <Box
            as="button"
            flex={1}
            h="100%"
            borderRadius="full"
            bg={activeTab === 'sunday' ? 'white' : 'transparent'}
            boxShadow={activeTab === 'sunday' ? '0 0 12px 4px rgba(255,255,255,0.25), 0 0 24px 8px rgba(255,255,255,0.1)' : 'none'}
            css={activeTab === 'sunday' ? {
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } : undefined}
            color={activeTab === 'sunday' ? '#313131' : '#E1E1E1'}
            fontWeight={activeTab === 'sunday' ? '600' : '500'}
            fontSize={{ base: '13px', md: '14px' }}
            transition="all 0.25s ease"
            onClick={() => setActiveTab('sunday')}
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap="6px"
            whiteSpace="nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12.358 5.57V11.78C12.358 12.11 12.227 12.43 11.992 12.66C11.758 12.9 11.44 13.03 11.108 13.03H0.893C0.561 13.03 0.243 12.9 0.009 12.66C-0.226 12.43 -0.357 12.11 -0.357 11.78V5.57H12.358Z" fill="#FEDB41" transform="translate(1,0)"/>
              <path d="M9.708 2.08H11.108C11.44 2.08 11.758 2.22 11.992 2.45C12.227 2.68 12.358 3 12.358 3.33V5.57H-0.357V3.33C-0.357 3 -0.226 2.68 0.009 2.45C0.243 2.22 0.561 2.08 0.893 2.08H9.708Z" fill="#00ACEA" transform="translate(1,0)"/>
              <path d="M8.303 8.46C8.497 9.45 7.881 10.78 6.058 11.52C6.021 11.54 5.978 11.54 5.941 11.52C4.124 10.8 3.503 9.46 3.696 8.46C3.825 7.78 4.3 7.34 4.915 7.34C5.261 7.34 5.63 7.48 6 7.76C6.363 7.49 6.738 7.35 7.078 7.35C7.694 7.35 8.168 7.79 8.303 8.46Z" fill="#D7443E" transform="translate(1,0)"/>
              <path d="M2.432 3.45C2.365 3.45 2.302 3.424 2.255 3.377C2.208 3.33 2.182 3.267 2.182 3.2V0.969C2.182 0.902 2.208 0.839 2.255 0.792C2.302 0.745 2.365 0.719 2.432 0.719C2.498 0.719 2.562 0.745 2.608 0.792C2.655 0.839 2.682 0.902 2.682 0.969V3.2C2.682 3.267 2.655 3.33 2.608 3.377C2.562 3.424 2.498 3.45 2.432 3.45ZM9.708 3.45C9.641 3.45 9.578 3.424 9.531 3.377C9.484 3.33 9.458 3.267 9.458 3.2V0.969C9.458 0.902 9.484 0.839 9.531 0.792C9.578 0.745 9.641 0.719 9.708 0.719C9.774 0.719 9.837 0.745 9.884 0.792C9.931 0.839 9.958 0.902 9.958 0.969V3.2C9.958 3.267 9.931 3.33 9.884 3.377C9.837 3.424 9.774 3.45 9.708 3.45Z" fill="#FEDB41" transform="translate(1,0)"/>
            </svg>
            इस रविवार
          </Box>
        </HStack>

        {/* Organizer Controls - Always show for organizers */}
        {(user?.email === 'organizer@test.com' || user?.role === 'ORGANIZER') && (
          <HStack spacing={4} justify="center" w="100%" flexWrap="wrap">
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
            <Button
              colorScheme="teal"
              onClick={() => navigate('/cohort-management')}
              size={{ base: 'sm', md: 'md' }}
              variant="solid"
            >
              Manage Cohort
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
              {(activeTab === 'all' || activeTab === 'live') && (
                <SoloGameCTA />
              )}

              {(activeTab === 'all' || activeTab === 'sunday') && currentRegistrationCard && (
                <RegistrationCard
                  card={currentRegistrationCard}
                  externalReminderSet={registrationReminderSet}
                  onReminderChange={setRegistrationReminderSet}
                />
              )}

              {(activeTab === 'sunday') && currentBanner && (
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
                    src={currentBanner.imageUrl.replace('http://', 'https://').replace('13.235.186.229:3000', 'api.tambola.me')}
                    alt="Promotional banner"
                    w="100%"
                    objectFit="contain"
                  />
                </Box>
              )}

              {(activeTab === 'sunday') && currentEmbed && (
                <Box
                  w="100%"
                  maxW={{ base: '100%', md: '800px', lg: '1000px' }}
                  mx="auto"
                  borderRadius="lg"
                  overflow="hidden"
                  boxShadow="xl"
                  border="2px"
                  borderColor="brand.500"
                  position="relative"
                >
                  <AspectRatio ratio={16 / 9}>
                    <iframe
                      id="lobby-yt-embed-1"
                      src={`https://www.youtube.com/embed/${currentEmbed.embedId}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${currentEmbed.embedId}&enablejsapi=1&origin=${window.location.origin}`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </AspectRatio>
                  <Box
                    as="button"
                    position="absolute"
                    bottom={3}
                    right={3}
                    bg="blackAlpha.700"
                    color="white"
                    borderRadius="full"
                    w="36px"
                    h="36px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="lg"
                    zIndex={2}
                    cursor="pointer"
                    _hover={{ bg: 'blackAlpha.800' }}
                    onClick={() => {
                      const iframe = document.getElementById('lobby-yt-embed-1') as HTMLIFrameElement;
                      if (iframe?.contentWindow) {
                        const cmd = videoMuted ? 'unMute' : 'mute';
                        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
                        setVideoMuted(!videoMuted);
                      }
                    }}
                  >
                    {videoMuted ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
                  </Box>
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
            <VStack spacing={4} w="100%">
            {(activeTab === 'all' || activeTab === 'sunday') && (
            <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }} gap={{ base: 3, md: 4 }} w="100%">
              {games.map((game) => (
                <GridItem key={game.id}>
                  <Box
                    borderRadius="12px"
                    overflow="hidden"
                    border="1px solid"
                    borderColor="#e5c07b"
                    bg="#fffbf0"
                    transition="all 0.2s"
                    _hover={{ boxShadow: 'lg', transform: 'translateY(-2px)' }}
                    h="100%"
                    w="100%"
                  >
                    {/* Live banner — like registration card's date strip */}
                    {game.status === 'ACTIVE' && (
                      <HStack
                        justify="center"
                        spacing={2}
                        py={2.5}
                        bg="#92400e"
                        w="100%"
                      >
                        <Box w="8px" h="8px" borderRadius="full" bg="#f87171" />
                        <Text fontSize="sm" fontWeight="bold" color="white" letterSpacing="wide">
                          चल रहा है — जल्दी Join करो!
                        </Text>
                      </HStack>
                    )}

                    {/* Card body */}
                    <VStack spacing={1} py={5} px={4}>
                      {/* Title */}
                      <Text
                        fontSize={{ base: '2xl', md: '3xl' }}
                        fontWeight="900"
                        color="#1a1a1a"
                        textAlign="center"
                        lineHeight="1.2"
                      >
                        Sunday Tambola
                      </Text>

                      {/* Subtitle */}
                      <Text
                        fontSize={{ base: 'sm', md: 'md' }}
                        color="#9ca3af"
                        textAlign="center"
                      >
                        हर रविवार, बड़े इनाम!
                      </Text>

                      {/* Accent line */}
                      <Box w="28px" h="3px" bg="#e5a00d" borderRadius="full" my={1} />

                      {/* Player count */}
                      <HStack spacing={2} pt={2}>
                        <Icon viewBox="0 0 24 24" boxSize={5} color="#e5a00d">
                          <path
                            fill="currentColor"
                            d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                          />
                        </Icon>
                        <Text fontSize="md" fontWeight="bold" color="#1a1a1a">
                          {(game.playerCount || 0).toLocaleString('en-IN')}+{' '}
                          <Text as="span" fontWeight="medium" color="#9ca3af">
                            खिलाड़ी
                          </Text>
                        </Text>
                      </HStack>
                    </VStack>

                    {/* Live video preview — only when game is ACTIVE and live stream exists */}
                    {game.status === 'ACTIVE' && currentLiveStream && (
                      <Box px={4} pb={3}>
                        <Box borderRadius="10px" overflow="hidden" border="2px solid" borderColor="#e5a00d">
                          <AspectRatio ratio={16 / 9}>
                            <iframe
                              src={`https://www.youtube.com/embed/${currentLiveStream.embedId}?autoplay=1&mute=1&controls=0&playsinline=1&modestbranding=1&rel=0`}
                              allow="autoplay; encrypted-media"
                              style={{ border: 'none' }}
                              title="Live stream preview"
                            />
                          </AspectRatio>
                        </Box>
                      </Box>
                    )}

                    {/* Countdown or CTA */}
                    <Box px={4} pb={4}>
                      {game.status === 'LOBBY' && <GameCountdown scheduledTime={game.scheduledTime} />}
                    </Box>

                    <Box px={4} pb={4}>

                      {(() => {
                        const isMyGame = myActiveGames.some((g) => g.id === game.id);
                        const isCreator = game.createdBy === user?.id;
                        const btnStyle = {
                          w: '100%',
                          size: 'lg' as const,
                          h: '52px',
                          fontSize: 'lg',
                          fontWeight: 'bold',
                          borderRadius: '10px',
                        };

                        if (isCreator) {
                          if (game.status === 'LOBBY') {
                            return (
                              <VStack w="100%" spacing={2}>
                                <Button {...btnStyle} bg="linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)" color="white" _hover={{ opacity: 0.9 }} onClick={() => handleStartGame(game.id)}>
                                  Start Game
                                </Button>
                                <Button {...btnStyle} h="40px" fontSize="sm" colorScheme="red" variant="outline" onClick={() => handleDeleteGame(game.id)}>
                                  Delete Game
                                </Button>
                              </VStack>
                            );
                          } else if (game.status === 'ACTIVE') {
                            return (
                              <Button {...btnStyle} bg="linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)" color="white" _hover={{ opacity: 0.9 }} onClick={() => navigate(`/game-control/${game.id}`)}>
                                Manage Game
                              </Button>
                            );
                          }
                        }

                        if (isMyGame) {
                          return (
                            <Button {...btnStyle} bg="linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)" color="white" _hover={{ opacity: 0.9 }} isLoading={joiningGameId === game.id} loadingText="शामिल हो रहे हैं..." onClick={() => handleRejoinGame(game)}>
                              फिर से शामिल हों
                            </Button>
                          );
                        }

                        const canJoin = canJoinGame(game.scheduledTime);
                        const isReminded = remindedGames.has(game.id);

                        if (game.status === 'ACTIVE') {
                          return (
                            <Button {...btnStyle} bg="linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)" color="white" _hover={{ opacity: 0.9 }} isLoading={joiningGameId === game.id} loadingText="शामिल हो रहे हैं..." onClick={() => handleJoinGame(game)}>
                              अभी Join करो
                            </Button>
                          );
                        }

                        if (canJoin) {
                          return (
                            <Button {...btnStyle} bg="linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)" color="white" _hover={{ opacity: 0.9 }} isLoading={joiningGameId === game.id} loadingText="शामिल हो रहे हैं..." onClick={() => handleJoinGame(game)}>
                              अभी Join करो
                            </Button>
                          );
                        }

                        return (
                          <Button {...btnStyle} bg={isReminded ? 'linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)' : 'transparent'} color={isReminded ? 'white' : '#d97706'} border="2px solid" borderColor="#d97706" _hover={{ opacity: 0.9 }} leftIcon={<BellIcon />} onClick={() => handleRemindMe(game.id)}>
                            {isReminded ? 'रिमाइंडर सेट' : 'मुझे याद दिलाएं'}
                          </Button>
                        );
                      })()}
                    </Box>
                  </Box>
                </GridItem>
              ))}
            </Grid>
            )}
            {(activeTab === 'all' || activeTab === 'live') && (
              <SoloGameCTA hasMultiplayerGame={games.length > 0} />
            )}
            </VStack>
          )}
        </Box>

        {/* Registration Card - shown when games exist */}
        {games.length > 0 && (activeTab === 'all' || activeTab === 'sunday') && currentRegistrationCard && (
          <RegistrationCard
            card={currentRegistrationCard}
            externalReminderSet={registrationReminderSet}
            onReminderChange={setRegistrationReminderSet}
          />
        )}

        {/* Promotional Banner - shown on Coming Sunday tab when games exist */}
        {games.length > 0 && activeTab === 'sunday' && currentBanner && (
          <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto">
            <Box
              borderRadius="lg"
              overflow="hidden"
              boxShadow="xl"
              border="2px"
              borderColor="brand.500"
            >
              <Image
                src={currentBanner.imageUrl.replace('http://', 'https://').replace('13.235.186.229:3000', 'api.tambola.me')}
                alt="Promotional banner"
                w="100%"
                objectFit="contain"
              />
            </Box>
          </Box>
        )}

        {/* YouTube Video - shown on Coming Sunday tab when games exist */}
        {games.length > 0 && activeTab === 'sunday' && currentEmbed && (
          <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto">
            <Box
              borderRadius="lg"
              overflow="hidden"
              boxShadow="xl"
              border="2px"
              borderColor="brand.500"
              position="relative"
            >
              <AspectRatio ratio={16 / 9}>
                <iframe
                  id="lobby-yt-embed-2"
                  src={`https://www.youtube.com/embed/${currentEmbed.embedId}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${currentEmbed.embedId}&enablejsapi=1&origin=${window.location.origin}`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </AspectRatio>
              <Box
                as="button"
                position="absolute"
                bottom={3}
                right={3}
                bg="blackAlpha.700"
                color="white"
                borderRadius="full"
                w="36px"
                h="36px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="lg"
                zIndex={2}
                cursor="pointer"
                _hover={{ bg: 'blackAlpha.800' }}
                onClick={() => {
                  const iframe = document.getElementById('lobby-yt-embed-2') as HTMLIFrameElement;
                  if (iframe?.contentWindow) {
                    const cmd = videoMuted ? 'unMute' : 'mute';
                    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
                    setVideoMuted(!videoMuted);
                  }
                }}
              >
                {videoMuted ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
              </Box>
            </Box>
          </Box>
        )}

        {/* How to Play Section (Hindi) — shown on Coming Sunday tab */}
        {activeTab === 'sunday' && <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto" mt={8}>
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
        </Box>}

        {/* Terms and Conditions Section — collapsible dropdown */}
        <Box w="100%" maxW={{ base: '100%', md: '900px', lg: '1200px' }} mx="auto" mb={8}>
          <Accordion allowToggle>
            <AccordionItem
              border="none"
              bg="grey.800"
              borderRadius="lg"
              boxShadow="md"
              overflow="hidden"
            >
              <AccordionButton
                px={{ base: 5, md: 6 }}
                py={{ base: 4, md: 5 }}
                _hover={{ bg: 'grey.700' }}
              >
                <Text flex="1" textAlign="center" fontWeight="bold" fontSize={{ base: 'md', md: 'lg' }} color="brand.500">
                  Terms & Conditions
                </Text>
                <AccordionIcon color="brand.500" />
              </AccordionButton>
              <AccordionPanel px={{ base: 5, md: 6 }} pb={{ base: 5, md: 6 }}>
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
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
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
