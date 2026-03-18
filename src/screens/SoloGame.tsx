import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Center,
  Spinner,
  useToast,
  Badge,
  Progress,
  AspectRatio,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { apiService } from '../services/api.service';
import { useSoloGameStore, type WinCategory } from '../stores/soloGameStore';
import { useAuthStore } from '../stores/authStore';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { SoloTicket } from '../components/solo/SoloTicket';
import { SoloNumberBoard } from '../components/solo/SoloNumberBoard';
import { SoloClaimButtons } from '../components/solo/SoloClaimButtons';
import { SoloGameResults } from '../components/solo/SoloGameResults';
import { SoloLeaderboard } from '../components/solo/SoloLeaderboard';
import { Logo } from '../components/Logo';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

type ViewState = 'loading' | 'start' | 'not_configured' | 'playing' | 'paused' | 'completed' | 'sunday';

const numberPulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

const categoryLabels: Record<string, string> = {
  EARLY_5: 'पहले 5',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

export default function SoloGame() {
  const navigate = useNavigate();
  const toast = useToast();
  const { trackEvent } = useTambolaTracking();
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [isStarting, setIsStarting] = useState(false);
  const [claimLoading, setClaimLoading] = useState<WinCategory | null>(null);
  const [gameMode, setGameMode] = useState<'fresh' | 'resume' | 'completed'>('fresh');
  const { user } = useAuthStore();

  // Name collection (same localStorage key as main game)
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  // Video state
  const [videoId, setVideoId] = useState<string | null>(null);
  const [numberTimestamps, setNumberTimestamps] = useState<number[]>([]);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [resumeAtSeconds, setResumeAtSeconds] = useState<number | undefined>(undefined);
  const gameCompleteCalledRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);

  const {
    soloGameId,
    ticket,
    currentIndex,
    gameStatus,
    isPlaying,
    initGame,
    resumeGame,
    advanceNumber,
    recordClaim,
    setPlaying,
    completeGame,
    getCurrentNumber,
    markedNumbers,
  } = useSoloGameStore();

  // YouTube player — autoplay baked into the iframe URL (muted for browser compat)
  const [soloVideoMuted, setSoloVideoMuted] = useState(true);
  const {
    playerState,
    currentTime,
    play: playVideo,
    pause: pauseVideo,
    mute: muteVideo,
    unMute: unMuteVideo,
  } = useYouTubePlayer({
    videoId,
    containerId: 'solo-youtube-player',
    autoplay: shouldAutoplay,
    startSeconds: resumeAtSeconds,
  });

  // Sync view state with player state
  useEffect(() => {
    if (!videoId || gameStatus !== 'IN_PROGRESS') return;

    if (playerState === 'playing') {
      setViewState('playing');
      setPlaying(true);
    } else if (playerState === 'paused') {
      if (isPlaying) {
        setViewState('paused');
        setPlaying(false);
      }
    } else if (playerState === 'ended') {
      handleGameComplete();
    }
  }, [playerState, videoId, gameStatus]);

  // Advance numbers based on video currentTime
  useEffect(() => {
    if (!isPlaying || numberTimestamps.length === 0) return;

    const state = useSoloGameStore.getState();
    if (state.currentIndex >= state.numberSequence.length) return;

    // Find how many numbers should have been called by this time
    let targetIndex = 0;
    for (let i = 0; i < numberTimestamps.length; i++) {
      if (currentTime >= numberTimestamps[i]) {
        targetIndex = i + 1;
      } else {
        break;
      }
    }

    // Advance to target if ahead of current
    if (targetIndex > state.currentIndex) {
      const gap = targetIndex - state.currentIndex;
      for (let i = 0; i < gap; i++) {
        advanceNumber();
      }
    }

    // Check if all 90 have been called
    if (targetIndex >= 90 && !gameCompleteCalledRef.current) {
      gameCompleteCalledRef.current = true;
      handleGameComplete();
    }
  }, [currentTime, numberTimestamps, isPlaying]);

  // Load game state on mount
  useEffect(() => {
    const loadGame = async () => {
      try {
        const result = await apiService.getMySoloGame();

        if (result.isSunday && !result.game) {
          setViewState('sunday');
          trackEvent({
            eventName: 'solo_leaderboard_viewed',
            properties: {
              week_id: result.currentWeek?.id || null,
              total_players: null,
            },
          });
          return;
        }

        if (!result.game) {
          if (!result.canPlay) {
            setViewState('sunday');
            trackEvent({
              eventName: 'solo_leaderboard_viewed',
              properties: {
                week_id: result.currentWeek?.id || null,
                total_players: null,
              },
            });
          } else if (result.isConfigured === false) {
            setViewState('not_configured');
          } else {
            setViewState('start');
          }
          return;
        }

        // Game exists — restore state into store but land on start screen
        if (result.game.status === 'COMPLETED') {
          resumeGame({
            soloGameId: result.game.id,
            weekId: result.game.weekId,
            ticket: result.game.ticket,
            numberSequence: result.game.numberSequence,
            currentIndex: result.game.currentIndex,
            markedNumbers: result.game.markedNumbers,
            gameStatus: 'COMPLETED',
            claims: result.game.claims as any,
          });
          setGameMode('completed');
          setViewState('start');
          return;
        }

        // In progress — restore state but land on start screen
        const localState = useSoloGameStore.getState();
        const serverIndex = result.game.currentIndex;
        const localIndex = localState.soloGameId === result.game.id ? localState.currentIndex : 0;
        const resolvedIndex = Math.max(serverIndex, localIndex);

        const localMarked = localState.soloGameId === result.game.id
          ? Array.from(localState.markedNumbers)
          : [];
        const serverMarked = result.game.markedNumbers || [];
        const mergedMarked = Array.from(new Set([...localMarked, ...serverMarked]));

        resumeGame({
          soloGameId: result.game.id,
          weekId: result.game.weekId,
          ticket: result.game.ticket,
          numberSequence: result.game.numberSequence,
          currentIndex: resolvedIndex,
          markedNumbers: mergedMarked,
          gameStatus: 'IN_PROGRESS',
          claims: result.game.claims as any,
        });

        // Store video/timestamp info — but DON'T set videoId yet
        // (setting videoId now would create iframe with autoplay=0;
        //  we set it in proceedEnterGame so the hook creates it with autoplay=1)
        if (result.numberTimestamps) setNumberTimestamps(result.numberTimestamps);

        // Calculate where to resume the video from
        const timestamps = result.numberTimestamps || [];
        if (resolvedIndex > 0 && resolvedIndex <= timestamps.length) {
          setResumeAtSeconds(timestamps[resolvedIndex - 1]);
        }

        // Store videoId in a ref for later — don't trigger hook yet
        pendingVideoIdRef.current = result.videoId || null;
        setGameMode('resume');
        setViewState('start');
      } catch (error) {
        console.error('Failed to load solo game:', error);
        setViewState('start');
      }
    };

    loadGame();
  }, []);

  // Save progress periodically (every 10 numbers)
  useEffect(() => {
    if (currentIndex > 0 && currentIndex % 10 === 0 && soloGameId && gameStatus === 'IN_PROGRESS') {
      apiService.updateSoloProgress({
        soloGameId,
        currentIndex,
        markedNumbers: Array.from(markedNumbers),
      }).catch(err => console.error('Failed to save progress:', err));
    }
  }, [currentIndex]);

  // Pause video on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isPlaying) {
        pauseVideo();
        trackEvent({
          eventName: 'solo_game_paused',
          properties: {
            solo_game_id: soloGameId,
            current_index: currentIndex,
            pause_reason: 'tab_hidden',
          },
        });
        if (soloGameId && gameStatus === 'IN_PROGRESS') {
          apiService.updateSoloProgress({
            soloGameId,
            currentIndex,
            markedNumbers: Array.from(markedNumbers),
          }).catch(err => console.error('Failed to save on hide:', err));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isPlaying, soloGameId, currentIndex, markedNumbers, gameStatus]);

  // Save on beforeunload
  useEffect(() => {
    const handleUnload = () => {
      if (soloGameId && gameStatus === 'IN_PROGRESS') {
        const data = JSON.stringify({
          soloGameId,
          currentIndex,
          markedNumbers: Array.from(markedNumbers),
        });
        const token = localStorage.getItem('auth_token');
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/solo/update-progress`;
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: data,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [soloGameId, currentIndex, markedNumbers, gameStatus]);

  // Intercept browser back button during gameplay — go to start screen instead of leaving
  useEffect(() => {
    if (viewState === 'playing' || viewState === 'paused' || viewState === 'completed') {
      // Push a dummy history entry so back button triggers popstate instead of leaving
      window.history.pushState({ soloGame: true }, '');

      const handlePopState = () => {
        if (soloGameId && gameStatus === 'IN_PROGRESS') {
          apiService.updateSoloProgress({
            soloGameId,
            currentIndex,
            markedNumbers: Array.from(markedNumbers),
          }).catch(() => {});
        }
        returnToStartScreen(gameStatus === 'COMPLETED' ? 'completed' : 'resume');
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [viewState, soloGameId, gameStatus, currentIndex, markedNumbers]);

  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      const result = await apiService.startSoloGame();
      initGame({
        soloGameId: result.soloGameId,
        weekId: result.weekId,
        ticket: result.ticket,
        numberSequence: result.numberSequence,
      });
      // Set video info with autoplay
      if (result.numberTimestamps) setNumberTimestamps(result.numberTimestamps);
      if (result.videoId) {
        setShouldAutoplay(true);
        setVideoId(result.videoId);
      }
      setViewState('playing'); // Go straight to playing — video autoplays
      trackEvent({
        eventName: 'solo_game_started',
        properties: {
          solo_game_id: result.soloGameId,
          week_id: result.weekId,
          video_id: result.videoId || null,
        },
      });
    } catch (error: any) {
      const message = error?.message || 'गेम शुरू नहीं हो सका';
      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsStarting(false);
    }
  };

  // Check if user has a name, show modal if not
  const isDefaultName = (name: string) => /^Player_/i.test(name) || /^user_/i.test(name);

  const hasPlayerName = (): boolean => {
    const savedName = localStorage.getItem('playerName');
    const userName = user?.name;
    const name = savedName || userName;
    return !!name && name.trim().length > 0 && !isDefaultName(name);
  };

  const handleNameSubmit = async () => {
    if (!tempName.trim()) return;
    const name = tempName.trim();

    // Save to localStorage (shared with main game)
    localStorage.setItem('playerName', name);
    setShowNameModal(false);
    setTempName('');

    // Save to database
    try {
      const response = await apiService.updateUserProfile({ name });
      if (response.user && user) {
        useAuthStore.getState().setUser({ ...user, name: response.user.name });
      }
    } catch (error) {
      console.error('Failed to save name to database:', error);
    }

    // Track registration
    trackEvent({
      eventName: 'player_registered',
      properties: { user_name: name },
    });

    // Now proceed with entering the game
    proceedEnterGame();
  };

  // When going back to start screen, park videoId in ref so hook can re-create iframe on re-entry
  const returnToStartScreen = (mode: 'resume' | 'completed') => {
    pauseVideo();
    if (videoId) {
      pendingVideoIdRef.current = videoId;
      setVideoId(null);
      setShouldAutoplay(false);
    }
    setGameMode(mode);
    setViewState('start');
  };

  const proceedEnterGame = () => {
    if (gameMode === 'completed') {
      setViewState('completed');
      trackEvent({
        eventName: 'solo_results_viewed',
        properties: {
          solo_game_id: soloGameId,
          total_claims: useSoloGameStore.getState().claims.size,
          categories_won: Array.from(useSoloGameStore.getState().claims.keys()),
        },
      });
    } else if (gameMode === 'resume') {
      setShouldAutoplay(true);
      // Now set videoId — hook will create iframe with autoplay=1
      if (pendingVideoIdRef.current) {
        setVideoId(pendingVideoIdRef.current);
        pendingVideoIdRef.current = null;
      }
      setViewState('playing');
      trackEvent({
        eventName: 'solo_game_resumed',
        properties: {
          solo_game_id: soloGameId,
          current_index: currentIndex,
          marked_count: markedNumbers.size,
          video_id: videoId,
        },
      });
    } else {
      // Fresh game — call handleStartGame
      handleStartGame();
    }
  };

  // Enter game from the start screen — check name first
  const handleEnterGame = () => {
    if (!hasPlayerName()) {
      setShowNameModal(true);
      return;
    }
    proceedEnterGame();
  };

  const handleResume = () => {
    playVideo();
  };

  const handlePause = () => {
    pauseVideo();
    trackEvent({
      eventName: 'solo_game_paused',
      properties: {
        solo_game_id: soloGameId,
        current_index: currentIndex,
        pause_reason: 'user_paused',
      },
    });
  };

  const handleGameComplete = async () => {
    completeGame();
    setViewState('completed');
    pauseVideo();
    const state = useSoloGameStore.getState();
    trackEvent({
      eventName: 'solo_game_completed',
      properties: {
        solo_game_id: state.soloGameId,
        week_id: state.weekId,
        total_marked: state.markedNumbers.size,
        total_claims: state.claims.size,
        categories_won: Array.from(state.claims.keys()),
        video_watched_fully: gameCompleteCalledRef.current,
      },
    });
    if (state.soloGameId) {
      try {
        await apiService.completeSoloGame({
          soloGameId: state.soloGameId,
          markedNumbers: Array.from(state.markedNumbers),
        });
      } catch (err) {
        console.error('Failed to mark game complete:', err);
      }
    }
  };

  const handleClaim = async (category: WinCategory) => {
    if (!soloGameId) return;
    setClaimLoading(category);
    trackEvent({
      eventName: 'solo_claim_attempted',
      properties: {
        solo_game_id: soloGameId,
        category,
        current_index: currentIndex,
        marked_count: markedNumbers.size,
      },
    });
    try {
      const result = await apiService.claimSoloCategory({
        soloGameId,
        category,
        currentNumberIndex: currentIndex - 1,
      });
      recordClaim(category, result.claim.numberCountAtClaim, result.claim.claimedAt);
      trackEvent({
        eventName: 'solo_claim_result',
        properties: {
          solo_game_id: soloGameId,
          category,
          success: true,
          rank: (result.claim as any).rank || null,
          numbers_called_to_claim: result.claim.numberCountAtClaim,
        },
      });
      toast({
        title: `${categoryLabels[category]} पूरी!`,
        description: 'सफलतापूर्वक दर्ज हो गया',
        status: 'success',
        duration: 3000,
      });
      if (result.gameComplete) {
        handleGameComplete();
      }
    } catch (error: any) {
      trackEvent({
        eventName: 'solo_claim_result',
        properties: {
          solo_game_id: soloGameId,
          category,
          success: false,
          rank: null,
          numbers_called_to_claim: currentIndex,
        },
      });
      toast({
        title: 'दावा असफल',
        description: error?.message || 'कुछ गलत हो गया',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setClaimLoading(null);
    }
  };

  const calledCount = currentIndex;
  const currentNumber = getCurrentNumber();
  const progress = (calledCount / 90) * 100;

  // ===== RENDER =====

  if (viewState === 'loading') {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bg="grey.900" p={{ base: 3, md: 4 }}>
      <VStack spacing={{ base: 2, md: 4 }} w="100%" maxW={{ base: '100%', md: '600px' }} mx="auto">
        {/* Header */}
        <HStack w="100%" justify="space-between" align="center">
          <Logo height={{ base: '20px', md: '24px' }} />
          <Heading size={{ base: 'sm', md: 'md' }} color="white">
            Live Tambola
          </Heading>
          <Button
            variant="outline"
            colorScheme="red"
            size="xs"
            onClick={() => {
              if (viewState === 'playing' || viewState === 'paused' || viewState === 'completed') {
                if (soloGameId && gameStatus === 'IN_PROGRESS') {
                  apiService.updateSoloProgress({
                    soloGameId,
                    currentIndex,
                    markedNumbers: Array.from(markedNumbers),
                  }).catch(() => {});
                }
                returnToStartScreen(gameStatus === 'COMPLETED' ? 'completed' : 'resume');
              } else {
                navigate('/lobby');
              }
            }}
          >
            वापस
          </Button>
        </HStack>

        {/* Not Configured */}
        {viewState === 'not_configured' && (
          <VStack spacing={6} py={8}>
            <Heading size="lg" color="white" textAlign="center">
              Live Tambola
            </Heading>
            <Text color="grey.300" textAlign="center" fontSize={{ base: 'sm', md: 'md' }}>
              इस हफ्ते का गेम अभी सेट नहीं हुआ है। कृपया बाद में आएं!
            </Text>
            <Button variant="outline" colorScheme="brand" onClick={() => navigate('/lobby')}>
              वापस जाएं
            </Button>
          </VStack>
        )}

        {/* Start Screen */}
        {viewState === 'start' && (
          <VStack spacing={6} py={8}>
            <Heading size="lg" color="white" textAlign="center">
              Live Tambola
            </Heading>
            <Text color="grey.300" textAlign="center" fontSize={{ base: 'sm', md: 'md' }}>
              वीडियो में नंबर बुलाए जाएंगे — आप मार्क करें और दावा करें।
            </Text>
            <Box bg="grey.800" borderRadius="lg" p={4} w="100%">
              <VStack spacing={2} fontSize="sm" color="grey.400">
                <HStack w="100%" justify="space-between">
                  <Text>खेल का समय</Text>
                  <Text color="white">सोमवार - शनिवार</Text>
                </HStack>
                <HStack w="100%" justify="space-between">
                  <Text>हफ्ते में कितनी बार</Text>
                  <Text color="white">1 बार</Text>
                </HStack>
                <HStack w="100%" justify="space-between">
                  <Text>विजेता घोषणा</Text>
                  <Text color="highlight.400">रविवार</Text>
                </HStack>
              </VStack>
            </Box>
            <Button
              colorScheme="brand"
              size="lg"
              w="100%"
              h="56px"
              fontSize="lg"
              fontWeight="bold"
              isLoading={isStarting}
              loadingText="शुरू हो रहा है..."
              onClick={handleEnterGame}
            >
              {gameMode === 'completed' ? 'टिकट देखो' : gameMode === 'resume' ? 'जारी रखें' : 'गेम शुरू करें'}
            </Button>
          </VStack>
        )}

        {/* Sunday / Results */}
        {viewState === 'sunday' && (
          <VStack spacing={6} py={8}>
            <Heading size="lg" color="highlight.400" textAlign="center">
              आज रिज़ल्ट डे है!
            </Heading>
            <SoloLeaderboard />
            <Button
              colorScheme="brand"
              variant="outline"
              onClick={() => navigate('/lobby')}
              size="lg"
            >
              लॉबी पर वापस जाएं
            </Button>
          </VStack>
        )}

        {/* Completed / Already Played */}
        {viewState === 'completed' && (
          <SoloGameResults onBackToLobby={() => returnToStartScreen('completed')} />
        )}

        {/* Active Game View — unified for playing and paused states */}
        {(viewState === 'playing' || viewState === 'paused') && ticket && (
          <VStack spacing={2} w="100%">
            {/* YouTube Player — compact 16:9, iframe created by hook */}
            {videoId && (
              <Box w="100%" maxW="600px" mx="auto" borderRadius="md" overflow="hidden" position="relative">
                <AspectRatio ratio={16 / 9}>
                  <Box
                    id="solo-youtube-player"
                    w="100%"
                    h="100%"
                  />
                </AspectRatio>
                {/* Overlay to block clicks on YouTube iframe + mute toggle */}
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  zIndex={1}
                />
                <Box
                  as="button"
                  position="absolute"
                  bottom={2}
                  right={2}
                  bg="blackAlpha.700"
                  color="white"
                  borderRadius="full"
                  w="32px"
                  h="32px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  zIndex={2}
                  cursor="pointer"
                  _hover={{ bg: 'blackAlpha.800' }}
                  onClick={() => {
                    if (soloVideoMuted) {
                      unMuteVideo();
                    } else {
                      muteVideo();
                    }
                    setSoloVideoMuted(!soloVideoMuted);
                  }}
                >
                  {soloVideoMuted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </Box>
              </Box>
            )}

            {/* Single control bar: Counter | Current Number | Play/Pause — all in one line */}
            <HStack w="100%" justify="space-between" align="center" bg="grey.800" borderRadius="md" px={3} py={2}>
              {/* Left: Counter */}
              <HStack spacing={1}>
                {!isPlaying && (
                  <Badge colorScheme="yellow" fontSize="2xs" px={1.5} py={0.5}>
                    रुका हुआ
                  </Badge>
                )}
                <Text color="grey.400" fontSize={{ base: 'xs', md: 'sm' }}>
                  <Text as="span" color="white" fontWeight="bold">{calledCount}</Text>/90
                </Text>
              </HStack>

              {/* Center: Current Number */}
              {currentNumber ? (
                <Box
                  bg="highlight.500"
                  borderRadius="md"
                  w={{ base: '42px', md: '48px' }}
                  h={{ base: '42px', md: '48px' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 0 12px rgba(239, 167, 63, 0.5)"
                  animation={`${numberPulse} 0.4s ease-out`}
                  key={currentNumber}
                  flexShrink={0}
                >
                  <Text color="white" fontWeight="extrabold" fontSize={{ base: 'lg', md: 'xl' }}>
                    {currentNumber}
                  </Text>
                </Box>
              ) : (
                <Box
                  bg="grey.700"
                  borderRadius="md"
                  w={{ base: '42px', md: '48px' }}
                  h={{ base: '42px', md: '48px' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Text color="grey.500" fontWeight="bold" fontSize={{ base: 'md', md: 'lg' }}>—</Text>
                </Box>
              )}

              {/* Right: Play/Pause Button */}
              <Button
                colorScheme={isPlaying ? 'yellow' : 'brand'}
                size="sm"
                px={4}
                fontWeight="bold"
                fontSize="sm"
                onClick={isPlaying ? handlePause : handleResume}
              >
                {isPlaying ? '⏸ रोकें' : '▶ चालू'}
              </Button>
            </HStack>

            {/* Thin progress bar */}
            <Progress value={progress} colorScheme="brand" w="100%" borderRadius="full" size="xs" />

            {/* Ticket */}
            <SoloTicket ticket={ticket} />

            {/* Claim Buttons */}
            <SoloClaimButtons onClaim={handleClaim} isClaimLoading={claimLoading} />

            {/* Number Board */}
            <SoloNumberBoard />
          </VStack>
        )}
      </VStack>

      {/* Name Collection Modal — same as Lobby */}
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
              '0%': { backgroundPosition: '0% 0%' },
              '100%': { backgroundPosition: '300% 0%' },
            },
            '@keyframes pulseBorder': {
              '0%, 100%': { filter: 'brightness(1) drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))' },
              '50%': { filter: 'brightness(1.5) drop-shadow(0 0 20px rgba(0, 255, 0, 0.8))' },
            },
          }}
          boxShadow="0 0 30px 5px rgba(0, 255, 0, 0.3), 0 0 60px 10px rgba(255, 215, 0, 0.2)"
        >
          <ModalHeader color="white" fontSize="lg" fontWeight="bold" pb={2} textAlign="center">
            Live Tambola खेलने के लिए अपना नाम दर्ज करें
          </ModalHeader>
          <ModalBody pb={6}>
            <FormControl>
              <Input
                placeholder="नाम लिखें"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleNameSubmit();
                }}
                autoFocus
                color="white"
                bg="rgba(255, 255, 255, 0.1)"
                borderColor="rgba(255, 255, 255, 0.3)"
                borderWidth="2px"
                _placeholder={{ color: 'rgba(255, 255, 255, 0.5)' }}
                _hover={{ borderColor: 'rgba(255, 255, 255, 0.5)', bg: 'rgba(255, 255, 255, 0.15)' }}
                _focus={{ borderColor: '#FFD700', boxShadow: '0 0 0 1px #FFD700, 0 0 15px rgba(255, 215, 0, 0.3)', bg: 'rgba(255, 255, 255, 0.15)' }}
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
              _hover={{ bg: 'brand.600', transform: 'scale(1.02)', boxShadow: '0 0 20px rgba(37, 141, 88, 0.6)' }}
              _active={{ bg: 'brand.700', transform: 'scale(0.98)' }}
              _disabled={{ bg: 'grey.600', color: 'grey.400', opacity: 0.5, cursor: 'not-allowed' }}
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
