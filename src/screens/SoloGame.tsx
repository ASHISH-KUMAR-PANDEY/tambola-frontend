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
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { apiService } from '../services/api.service';
import { useSoloGameStore, type WinCategory } from '../stores/soloGameStore';
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
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [isStarting, setIsStarting] = useState(false);
  const [claimLoading, setClaimLoading] = useState<WinCategory | null>(null);

  // Video state
  const [videoId, setVideoId] = useState<string | null>(null);
  const [numberTimestamps, setNumberTimestamps] = useState<number[]>([]);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [resumeAtSeconds, setResumeAtSeconds] = useState<number | undefined>(undefined);
  const gameCompleteCalledRef = useRef(false);

  const {
    soloGameId,
    ticket,
    currentIndex,
    gameStatus,
    isPlaying,
    claims,
    initGame,
    resumeGame,
    advanceNumber,
    recordClaim,
    setPlaying,
    completeGame,
    getCalledNumbers,
    getCurrentNumber,
    getMarkedCount,
    markedNumbers,
  } = useSoloGameStore();

  // YouTube player — autoplay baked into the iframe URL
  const {
    isReady: isPlayerReady,
    playerState,
    currentTime,
    play: playVideo,
    pause: pauseVideo,
    seekTo,
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
          return;
        }

        if (!result.game) {
          if (!result.canPlay) {
            setViewState('sunday');
          } else if (result.isConfigured === false) {
            setViewState('not_configured');
          } else {
            setViewState('start');
          }
          return;
        }

        // Game exists
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
          setViewState('completed');
          return;
        }

        // In progress — resume with autoplay
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

        // Calculate where to resume the video from
        const timestamps = result.numberTimestamps || [];
        if (resolvedIndex > 0 && resolvedIndex <= timestamps.length) {
          setResumeAtSeconds(timestamps[resolvedIndex - 1]);
        }

        // Set video info and autoplay
        if (result.numberTimestamps) setNumberTimestamps(result.numberTimestamps);
        if (result.videoId) {
          setShouldAutoplay(true);
          setVideoId(result.videoId);
        }
        setViewState('playing');
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

  const handleResume = () => {
    playVideo();
  };

  const handlePause = () => {
    pauseVideo();
  };

  const handleGameComplete = async () => {
    completeGame();
    setViewState('completed');
    pauseVideo();
    const state = useSoloGameStore.getState();
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
    try {
      const result = await apiService.claimSoloCategory({
        soloGameId,
        category,
        currentNumberIndex: currentIndex - 1,
      });
      recordClaim(category, result.claim.numberCountAtClaim, result.claim.claimedAt);
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
            Daily Tambola
          </Heading>
          <Button
            variant="outline"
            colorScheme="red"
            size="xs"
            onClick={() => navigate('/lobby')}
          >
            वापस
          </Button>
        </HStack>

        {/* Not Configured */}
        {viewState === 'not_configured' && (
          <VStack spacing={6} py={8}>
            <Heading size="lg" color="white" textAlign="center">
              Daily Tambola
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
              Daily Tambola
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
              onClick={handleStartGame}
            >
              गेम शुरू करें
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
          <SoloGameResults onBackToLobby={() => navigate('/lobby')} />
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
                {/* Invisible overlay to block clicks on the YouTube iframe */}
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  zIndex={1}
                />
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
    </Box>
  );
}
