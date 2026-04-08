import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { apiService, type CategoryRankingsResponse, type SoloGameData } from '../services/api.service';
import { useSoloGameStore, type WinCategory } from '../stores/soloGameStore';
import { useAuthStore } from '../stores/authStore';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { SoloTicket } from '../components/solo/SoloTicket';
import { SoloNumberBoard } from '../components/solo/SoloNumberBoard';
import { SoloClaimButtons } from '../components/solo/SoloClaimButtons';
import { SoloGameResults } from '../components/solo/SoloGameResults';
import { SoloLeaderboard } from '../components/solo/SoloLeaderboard';
import { HowToPlay } from '../components/solo/HowToPlay';
import { InstallWall } from '../components/solo/InstallWall';
import { LoginWall } from '../components/solo/LoginWall';
import { Logo } from '../components/Logo';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { useFlutterBridge } from '../hooks/useFlutterBridge';
import { isAnonymousUser } from '../utils/anonymousUser';

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
  const [, setGameMode] = useState<'fresh' | 'resume' | 'completed'>('fresh');
  const [categoryRankings, setCategoryRankings] = useState<CategoryRankingsResponse | null>(null);
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  // Game 2 state
  const [activeGameNumber, setActiveGameNumber] = useState<number>(1);
  const [game1Info, setGame1Info] = useState<SoloGameData | null>(null);
  const [game2Info, setGame2Info] = useState<SoloGameData | null>(null);
  const [game2Status, setGame2Status] = useState<{
    available: boolean;
    cooldownEndsAt: string | null;
    configured: boolean;
  } | null>(null);
  const [cooldownText, setCooldownText] = useState<string>('');

  // Name collection (same localStorage key as main game)
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  // 3-stage funnel walls — web users only, never in Flutter WebView.
  // LoginWall fires when an anonymous user wins their first category.
  // InstallWall fires when a logged-in user wins their first category
  // in the current component mount (which is the SECOND claim overall
  // for users who came through the LoginWall path, or the FIRST claim
  // for users who were already logged in when they entered the game).
  // Plan: /Users/stageadmin/.claude/plans/merry-hatching-prism.md
  const { isFlutterApp } = useFlutterBridge();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [loginWallCategory, setLoginWallCategory] = useState<WinCategory | null>(null);
  const [loginWallNumbersAtWin, setLoginWallNumbersAtWin] = useState(0);
  const [loginWallAnonId, setLoginWallAnonId] = useState('');
  const loginWallShownRef = useRef(false);

  const [showInstallWall, setShowInstallWall] = useState(false);
  const [installWallCategory, setInstallWallCategory] = useState<WinCategory | null>(null);
  const [installWallNumbersAtWin, setInstallWallNumbersAtWin] = useState(0);
  const installWallShownRef = useRef(false);

  // Video state
  const [videoId, setVideoId] = useState<string | null>(null);
  const [preloadVideoId, setPreloadVideoId] = useState<string | null>(null); // hidden preload on start screen
  const [numberTimestamps, setNumberTimestamps] = useState<number[]>([]);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [resumeAtSeconds, setResumeAtSeconds] = useState<number | undefined>(undefined);
  const [videoLoading, setVideoLoading] = useState(false); // loading overlay
  const [showTapToPlay, setShowTapToPlay] = useState(false); // fallback when autoplay blocked
  const gameCompleteCalledRef = useRef(false);
  const nearEndToastShownRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const pendingGameNumRef = useRef<number>(1);
  // Video info per game for switching
  const game1VideoRef = useRef<{ videoId: string | null; timestamps: number[] }>({ videoId: null, timestamps: [] });
  const game2VideoRef = useRef<{ videoId: string | null; timestamps: number[] }>({ videoId: null, timestamps: [] });

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

  // Autoplay fallback — if video doesn't start within 5s, show "Tap to Play"
  useEffect(() => {
    if (!videoLoading) { setShowTapToPlay(false); return; }
    const timer = setTimeout(() => {
      if (videoLoading) {
        setShowTapToPlay(true);
        trackEvent({
          eventName: 'solo_autoplay_fallback_shown',
          properties: { video_id: videoId, player_state: playerState },
        });
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [videoLoading]);

  // Sync view state with player state
  useEffect(() => {
    if (!videoId || gameStatus !== 'IN_PROGRESS') return;

    if (playerState === 'playing') {
      setViewState('playing');
      setPlaying(true);
      setVideoLoading(false); // Dismiss loading overlay — video is playing
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

    // Near-end popup — show when second-to-last number is called
    if (targetIndex >= 88 && targetIndex < 90 && !nearEndToastShownRef.current) {
      nearEndToastShownRef.current = true;
      const isTicket1 = activeGameNumber === 1;
      const hasTicket2Available = game2Status?.configured && !game2Info?.status;
      trackEvent({
        eventName: 'solo_near_end_nudge_shown',
        properties: {
          game_number: activeGameNumber,
          has_ticket2_available: !!hasTicket2Available,
          numbers_called: targetIndex,
        },
      });
      toast({
        title: isTicket1 && hasTicket2Available
          ? '🎯 मज़ा आया? कल दूसरा टिकट भी खेलना!'
          : '🎉 मज़ा आया? अगले हफ्ते फिर मिलते हैं!',
        status: 'info',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
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

        // Store both games' data for start screen display
        const g1 = result.game1 || result.game;
        const g2 = result.game2 || null;
        setGame1Info(g1);
        setGame2Info(g2);
        if (result.game2Status) setGame2Status(result.game2Status);

        // Store video info for both games
        game1VideoRef.current = { videoId: result.videoId || null, timestamps: result.numberTimestamps || [] };
        game2VideoRef.current = { videoId: result.game2VideoId || null, timestamps: result.game2NumberTimestamps || [] };

        if (result.isSunday && !g1) {
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

        if (!g1) {
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

        // Determine which game to preload into store
        // Priority: IN_PROGRESS games > URL param > completed
        const urlGameParam = searchParams.get('game');
        let preloadGameNum = 1;

        if (g2?.status === 'IN_PROGRESS') {
          preloadGameNum = 2;
        } else if (g1?.status === 'IN_PROGRESS') {
          preloadGameNum = 1;
        } else if (urlGameParam === '2' && g2) {
          preloadGameNum = 2;
        }

        setActiveGameNumber(preloadGameNum);

        const primaryGame = preloadGameNum === 2 ? g2 : g1;
        const videoInfo = preloadGameNum === 2 ? game2VideoRef.current : game1VideoRef.current;

        if (!primaryGame) {
          setViewState('start');
          return;
        }

        // Game exists — restore state into store but land on start screen
        if (primaryGame.status === 'COMPLETED') {
          resumeGame({
            soloGameId: primaryGame.id,
            weekId: primaryGame.weekId,
            gameNumber: preloadGameNum,
            ticket: primaryGame.ticket,
            numberSequence: primaryGame.numberSequence,
            currentIndex: primaryGame.currentIndex,
            markedNumbers: primaryGame.markedNumbers || [],
            gameStatus: 'COMPLETED',
            claims: primaryGame.claims as any,
          });
          setGameMode('completed');
          setViewState('start');
          fetchCategoryRankings(preloadGameNum);
          return;
        }

        // In progress — restore state but land on start screen
        const localState = useSoloGameStore.getState();
        const serverIndex = primaryGame.currentIndex;
        const localIndex = localState.soloGameId === primaryGame.id ? localState.currentIndex : 0;
        const resolvedIndex = Math.max(serverIndex, localIndex);

        const localMarked = localState.soloGameId === primaryGame.id
          ? Array.from(localState.markedNumbers)
          : [];
        const serverMarked = primaryGame.markedNumbers || [];
        const mergedMarked = Array.from(new Set([...localMarked, ...serverMarked]));

        resumeGame({
          soloGameId: primaryGame.id,
          weekId: primaryGame.weekId,
          gameNumber: preloadGameNum,
          ticket: primaryGame.ticket,
          numberSequence: primaryGame.numberSequence,
          currentIndex: resolvedIndex,
          markedNumbers: mergedMarked,
          gameStatus: 'IN_PROGRESS',
          claims: primaryGame.claims as any,
        });

        // Store video/timestamp info — but DON'T set videoId yet
        if (videoInfo.timestamps.length > 0) setNumberTimestamps(videoInfo.timestamps);

        // Calculate where to resume the video from
        const timestamps = videoInfo.timestamps;
        if (resolvedIndex > 0 && resolvedIndex <= timestamps.length) {
          setResumeAtSeconds(timestamps[resolvedIndex - 1]);
        }

        // Store videoId in ref AND start hidden preload on start screen
        pendingVideoIdRef.current = videoInfo.videoId;
        if (videoInfo.videoId) setPreloadVideoId(videoInfo.videoId);
        setGameMode('resume');
        setViewState('start');
        // Fetch rankings if user has claims
        if (primaryGame.claims && primaryGame.claims.length > 0) {
          fetchCategoryRankings(preloadGameNum);
        }
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
            game_number: activeGameNumber,
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

  const handleStartGame = async (gameNum: number = activeGameNumber) => {
    setIsStarting(true);
    try {
      const result = await apiService.startSoloGame(gameNum);
      initGame({
        soloGameId: result.soloGameId,
        weekId: result.weekId,
        gameNumber: gameNum,
        ticket: result.ticket,
        numberSequence: result.numberSequence,
      });
      setActiveGameNumber(gameNum);
      // Set video info with autoplay
      if (result.numberTimestamps) setNumberTimestamps(result.numberTimestamps);
      if (result.videoId) {
        setShouldAutoplay(true);
        setVideoId(result.videoId);
      }
      setViewState('playing'); // Go straight to playing — video autoplays
      // Update local game info for start screen
      if (gameNum === 2) {
        setGame2Info({ id: result.soloGameId, status: 'IN_PROGRESS', weekId: result.weekId } as any);
      } else {
        setGame1Info({ id: result.soloGameId, status: 'IN_PROGRESS', weekId: result.weekId } as any);
      }
      trackEvent({
        eventName: 'solo_game_started',
        properties: {
          solo_game_id: result.soloGameId,
          week_id: result.weekId,
          game_number: gameNum,
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
    proceedEnterGame(pendingGameNumRef.current);
  };

  // When going back to start screen, park videoId in ref so hook can re-create iframe on re-entry
  const returnToStartScreen = (mode: 'resume' | 'completed') => {
    pauseVideo();
    if (videoId) {
      pendingVideoIdRef.current = videoId;
      setPreloadVideoId(videoId); // Re-start hidden preload for next entry
      setVideoId(null);
      setShouldAutoplay(false);
    }
    setVideoLoading(false);
    setGameMode(mode);
    setViewState('start');
  };

  // Load a specific game into the Zustand store (for switching between Game 1 and Game 2)
  const ensureGameLoaded = (gameNum: number) => {
    const storeState = useSoloGameStore.getState();
    const gameInfo = gameNum === 2 ? game2Info : game1Info;
    const videoInfo = gameNum === 2 ? game2VideoRef.current : game1VideoRef.current;

    // Already loaded
    if (storeState.gameNumber === gameNum && storeState.soloGameId === gameInfo?.id) {
      return;
    }

    if (!gameInfo) return; // Fresh game — will be loaded by handleStartGame

    if (gameInfo.status === 'COMPLETED') {
      resumeGame({
        soloGameId: gameInfo.id,
        weekId: gameInfo.weekId,
        gameNumber: gameNum,
        ticket: gameInfo.ticket,
        numberSequence: gameInfo.numberSequence,
        currentIndex: gameInfo.currentIndex,
        markedNumbers: gameInfo.markedNumbers || [],
        gameStatus: 'COMPLETED',
        claims: gameInfo.claims as any,
      });
    } else if (gameInfo.status === 'IN_PROGRESS') {
      const localState = useSoloGameStore.getState();
      const serverIndex = gameInfo.currentIndex;
      const localIndex = localState.soloGameId === gameInfo.id ? localState.currentIndex : 0;
      const resolvedIndex = Math.max(serverIndex, localIndex);
      const localMarked = localState.soloGameId === gameInfo.id ? Array.from(localState.markedNumbers) : [];
      const serverMarked = gameInfo.markedNumbers || [];
      const mergedMarked = Array.from(new Set([...localMarked, ...serverMarked]));

      resumeGame({
        soloGameId: gameInfo.id,
        weekId: gameInfo.weekId,
        gameNumber: gameNum,
        ticket: gameInfo.ticket,
        numberSequence: gameInfo.numberSequence,
        currentIndex: resolvedIndex,
        markedNumbers: mergedMarked,
        gameStatus: 'IN_PROGRESS',
        claims: gameInfo.claims as any,
      });

      if (videoInfo.timestamps.length > 0) setNumberTimestamps(videoInfo.timestamps);
      const timestamps = videoInfo.timestamps;
      if (resolvedIndex > 0 && resolvedIndex <= timestamps.length) {
        setResumeAtSeconds(timestamps[resolvedIndex - 1]);
      }
      pendingVideoIdRef.current = videoInfo.videoId;
    }
  };

  const proceedEnterGame = (gameNum: number = pendingGameNumRef.current) => {
    const gameInfo = gameNum === 2 ? game2Info : game1Info;

    // Determine mode for this game
    const mode: 'fresh' | 'resume' | 'completed' =
      gameInfo?.status === 'COMPLETED' ? 'completed'
      : gameInfo?.status === 'IN_PROGRESS' ? 'resume'
      : 'fresh';

    // Ensure correct game is in the store
    ensureGameLoaded(gameNum);
    setActiveGameNumber(gameNum);
    setGameMode(mode);

    if (mode === 'completed') {
      setViewState('completed');
      fetchCategoryRankings(gameNum);
      trackEvent({
        eventName: 'solo_results_viewed',
        properties: {
          solo_game_id: gameInfo?.id,
          game_number: gameNum,
          total_claims: useSoloGameStore.getState().claims.size,
          categories_won: Array.from(useSoloGameStore.getState().claims.keys()),
        },
      });
    } else if (mode === 'resume') {
      setVideoLoading(true); // Show loading overlay
      setShouldAutoplay(true);
      setPreloadVideoId(null); // Stop hidden preload
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
          game_number: gameNum,
          current_index: currentIndex,
          marked_count: markedNumbers.size,
          video_id: videoId,
        },
      });
    } else {
      // Fresh game — call handleStartGame
      setVideoLoading(true);
      handleStartGame(gameNum);
    }
  };

  // Enter game from the start screen — check name first
  const handleEnterGame = (gameNum: number = 1) => {
    pendingGameNumRef.current = gameNum;
    if (!hasPlayerName()) {
      setShowNameModal(true);
      return;
    }
    proceedEnterGame(gameNum);
  };


  const handleGameComplete = async () => {
    completeGame();
    setViewState('completed');
    pauseVideo();
    fetchCategoryRankings(activeGameNumber);
    // Update local game info for start screen
    if (activeGameNumber === 2) {
      setGame2Info(prev => prev ? { ...prev, status: 'COMPLETED' as const, completedAt: new Date().toISOString() } as SoloGameData : prev);
    } else {
      setGame1Info(prev => prev ? { ...prev, status: 'COMPLETED' as const, completedAt: new Date().toISOString() } as SoloGameData : prev);
      // When Game 1 completes, start cooldown for Game 2 (if configured)
      if (game2Status?.configured) {
        const cooldownEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        setGame2Status(prev => prev ? { ...prev, available: false, cooldownEndsAt: cooldownEnd } : prev);
      }
    }
    const state = useSoloGameStore.getState();
    trackEvent({
      eventName: 'solo_game_completed',
      properties: {
        solo_game_id: state.soloGameId,
        week_id: state.weekId,
        game_number: activeGameNumber,
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
        game_number: activeGameNumber,
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
      // Re-fetch rankings after successful claim
      fetchCategoryRankings(activeGameNumber);

      // 3-stage funnel wall triggers — web users only.
      // Plan: /Users/stageadmin/.claude/plans/merry-hatching-prism.md
      if (!isFlutterApp) {
        const currentUserId = useAuthStore.getState().user?.id ?? '';
        const isAnon = isAnonymousUser(currentUserId);

        if (isAnon && !loginWallShownRef.current) {
          // Anonymous user's first win → LoginWall (hard gate to convert
          // them to a real tambola user before they can keep playing).
          loginWallShownRef.current = true;
          setLoginWallCategory(category);
          setLoginWallNumbersAtWin(result.claim.numberCountAtClaim);
          setLoginWallAnonId(currentUserId);
          setShowLoginWall(true);
        } else if (!isAnon && !installWallShownRef.current) {
          // Logged-in user's first win in this component mount → InstallWall
          // (existing behavior). For users who came through the LoginWall
          // path this is naturally their second overall claim; for users
          // who were already logged in when they entered the game this is
          // their first claim.
          installWallShownRef.current = true;
          setInstallWallCategory(category);
          setInstallWallNumbersAtWin(result.claim.numberCountAtClaim);
          setShowInstallWall(true);
        }
      }
      trackEvent({
        eventName: 'solo_claim_result',
        properties: {
          solo_game_id: soloGameId,
          game_number: activeGameNumber,
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
          game_number: activeGameNumber,
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

  // Fake live player count — fluctuates during gameplay
  const [livePlayerCount, setLivePlayerCount] = useState(() => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const base = 300 + ((seed * 9301 + 49297) % 233280) / 233280 * 200;
    return Math.floor(base);
  });

  useEffect(() => {
    if (viewState !== 'playing' && viewState !== 'paused') return;
    const interval = setInterval(() => {
      setLivePlayerCount(prev => {
        // Small random fluctuation with net positive bias
        const change = Math.floor(Math.random() * 7) - 2; // -2 to +4
        return Math.max(200, prev + change);
      });
    }, 8000 + Math.random() * 7000); // Every 8-15 seconds
    return () => clearInterval(interval);
  }, [viewState]);

  // Bump count when a new number is called
  useEffect(() => {
    if (currentIndex > 0 && (viewState === 'playing' || viewState === 'paused')) {
      setLivePlayerCount(prev => prev + Math.floor(Math.random() * 5) + 1);
    }
  }, [currentIndex]);

  // Fetch category rankings
  const fetchCategoryRankings = async (gameNum?: number) => {
    try {
      const result = await apiService.getSoloCategoryRankings(undefined, gameNum);
      setCategoryRankings(result);
    } catch (error) {
      console.error('Failed to fetch category rankings:', error);
    }
  };

  // Countdown timer for Game 2 cooldown
  useEffect(() => {
    if (!game2Status?.cooldownEndsAt) {
      setCooldownText('');
      return;
    }
    const update = () => {
      const end = new Date(game2Status.cooldownEndsAt!).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setCooldownText('');
        setGame2Status(prev => prev ? { ...prev, available: true, cooldownEndsAt: null } : prev);
        trackEvent({
          eventName: 'solo_ticket2_unlocked',
          properties: {
            unlocked_while_on_screen: true,
          },
        });
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCooldownText(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [game2Status?.cooldownEndsAt]);

  // Derive Game 2 card state for start screen
  const game2CardState = (() => {
    if (!game2Status?.configured) return 'hidden' as const;
    const g1Done = game1Info?.status === 'COMPLETED';
    if (!g1Done) return 'locked' as const;
    if (game2Status.cooldownEndsAt && !game2Status.available && !game2Info) return 'countdown' as const;
    if (game2Status.available && !game2Info) return 'available' as const;
    if (game2Info?.status === 'IN_PROGRESS') return 'in_progress' as const;
    if (game2Info?.status === 'COMPLETED') return 'completed' as const;
    return 'hidden' as const;
  })();

  // Track Ticket 2 card state impression on start screen
  const ticket2ImpressionRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewState !== 'start' || game2CardState === 'hidden') return;
    if (ticket2ImpressionRef.current === game2CardState) return;
    ticket2ImpressionRef.current = game2CardState;
    trackEvent({
      eventName: 'solo_ticket2_card_viewed',
      properties: {
        card_state: game2CardState,
        cooldown_remaining: cooldownText || null,
      },
    });
  }, [viewState, game2CardState]);

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
          <VStack spacing={5} py={6}>
            <VStack spacing={1}>
              <Heading size="lg" color="white" textAlign="center">
                Live Tambola
              </Heading>
              <Text color="grey.400" textAlign="center" fontSize="sm">
                वीडियो में नंबर बुलाए जाएंगे — मार्क करें और दावा करें
              </Text>
            </VStack>

            {/* ── Game 1 Card ── */}
            <Box
              bg="grey.800"
              borderRadius="xl"
              w="100%"
              overflow="hidden"
              border="1px solid"
              borderColor={game1Info?.status === 'COMPLETED' ? 'brand.500' : game1Info?.status === 'IN_PROGRESS' ? 'brand.700' : 'grey.600'}
            >
              {/* Card Header */}
              <HStack
                bg={game1Info?.status === 'COMPLETED' ? 'rgba(37, 141, 88, 0.2)' : 'rgba(37, 141, 88, 0.08)'}
                px={4}
                py={2.5}
                justify="space-between"
                borderBottom="1px solid"
                borderColor="grey.700"
              >
                <HStack spacing={2}>
                  <Text fontSize="md" fontWeight="bold" color="white">🎯 टिकट 1</Text>
                </HStack>
                {game1Info?.status === 'COMPLETED' && (
                  <Badge colorScheme="green" fontSize="xs" borderRadius="full" px={2}>
                    ✅ आपने खेल लिया
                  </Badge>
                )}
                {game1Info?.status === 'IN_PROGRESS' && (
                  <Badge colorScheme="yellow" fontSize="xs" borderRadius="full" px={2}>
                    🎮 चल रहा है
                  </Badge>
                )}
                {!game1Info?.status && (
                  <Badge colorScheme="gray" fontSize="xs" borderRadius="full" px={2}>
                    नया मौका
                  </Badge>
                )}
              </HStack>
              {/* Card Body */}
              <Box px={4} py={4}>
                <Button
                  colorScheme="brand"
                  size="lg"
                  w="100%"
                  h="50px"
                  fontSize="md"
                  fontWeight="bold"
                  isLoading={isStarting && activeGameNumber === 1}
                  loadingText="शुरू हो रहा है..."
                  onClick={() => handleEnterGame(1)}
                  variant={game1Info?.status === 'COMPLETED' ? 'outline' : 'solid'}
                >
                  {game1Info?.status === 'COMPLETED' ? '🎫 टिकट देखो' : game1Info?.status === 'IN_PROGRESS' ? '▶️ जारी रखें' : '🎮 पहला मौका खेलें'}
                </Button>
              </Box>
            </Box>

            {/* ── Game 2 Card ── */}
            {game2CardState !== 'hidden' && (
              <Box
                bg="grey.800"
                borderRadius="xl"
                w="100%"
                overflow="hidden"
                border="1px solid"
                borderColor={
                  game2CardState === 'completed' ? 'purple.500'
                    : game2CardState === 'in_progress' ? 'purple.700'
                    : game2CardState === 'available' ? 'purple.600'
                    : 'highlight.500'
                }
                opacity={game2CardState === 'locked' ? 0.85 : 1}
              >
                {/* Card Header */}
                <HStack
                  bg={
                    game2CardState === 'completed' ? 'rgba(128, 90, 213, 0.2)'
                      : game2CardState === 'in_progress' || game2CardState === 'available' ? 'rgba(128, 90, 213, 0.12)'
                      : 'rgba(128, 90, 213, 0.06)'
                  }
                  px={4}
                  py={2.5}
                  justify="space-between"
                  borderBottom="1px solid"
                  borderColor="grey.700"
                >
                  <HStack spacing={2}>
                    <Text fontSize="md" fontWeight="bold" color="white">🎯 टिकट 2</Text>
                  </HStack>
                  {game2CardState === 'completed' && (
                    <Badge colorScheme="purple" fontSize="xs" borderRadius="full" px={2}>
                      ✅ आपने खेल लिया
                    </Badge>
                  )}
                  {game2CardState === 'in_progress' && (
                    <Badge colorScheme="yellow" fontSize="xs" borderRadius="full" px={2}>
                      🎮 चल रहा है
                    </Badge>
                  )}
                  {game2CardState === 'available' && (
                    <Badge colorScheme="green" fontSize="xs" borderRadius="full" px={2}>
                      🎮 मौका तैयार!
                    </Badge>
                  )}
                  {game2CardState === 'locked' && (
                    <Badge colorScheme="gray" fontSize="xs" borderRadius="full" px={2}>
                      🔒 लॉक
                    </Badge>
                  )}
                  {game2CardState === 'countdown' && (
                    <Badge colorScheme="yellow" fontSize="xs" borderRadius="full" px={2}>
                      ⏳ अगला मौका जल्द
                    </Badge>
                  )}
                </HStack>
                {/* Card Body */}
                <Box px={4} py={4}>
                  {game2CardState === 'locked' && (
                    <Text color="grey.400" fontSize="sm" textAlign="center">
                      पहले Ticket 1 खेलें — फिर 24 घंटे बाद दूसरा मौका मिलेगा
                    </Text>
                  )}

                  {game2CardState === 'countdown' && (
                    <VStack spacing={2}>
                      <Text color="grey.300" fontSize="sm" textAlign="center">
                        अगला मौका अनलॉक होगा
                      </Text>
                      <HStack
                        bg="rgba(239, 167, 63, 0.1)"
                        border="1px solid"
                        borderColor="rgba(239, 167, 63, 0.3)"
                        borderRadius="lg"
                        px={4}
                        py={2}
                        justify="center"
                      >
                        <Text color="highlight.400" fontSize="2xl" fontWeight="bold" fontFamily="mono">
                          {cooldownText}
                        </Text>
                      </HStack>
                    </VStack>
                  )}

                  {(game2CardState === 'available' || game2CardState === 'in_progress' || game2CardState === 'completed') && (
                    <Button
                      colorScheme="purple"
                      size="lg"
                      w="100%"
                      h="50px"
                      fontSize="md"
                      fontWeight="bold"
                      isLoading={isStarting && activeGameNumber === 2}
                      loadingText="शुरू हो रहा है..."
                      onClick={() => {
                        trackEvent({
                          eventName: 'solo_ticket2_cta_clicked',
                          properties: {
                            clicked_from: 'start_screen',
                            card_state: game2CardState,
                          },
                        });
                        handleEnterGame(2);
                      }}
                      variant={game2CardState === 'completed' ? 'outline' : 'solid'}
                    >
                      {game2CardState === 'completed' ? '🎫 टिकट देखो'
                        : game2CardState === 'in_progress' ? '▶️ जारी रखें'
                        : '🎮 दूसरा मौका खेलें'}
                    </Button>
                  )}
                </Box>
              </Box>
            )}

            {/* Info strip */}
            <HStack
              w="100%"
              bg="grey.800"
              borderRadius="lg"
              px={4}
              py={3}
              justify="space-around"
              spacing={4}
              border="1px solid"
              borderColor="grey.700"
            >
              <VStack spacing={0}>
                <Text fontSize="xs" color="grey.400">खेल का दिन</Text>
                <Text fontSize="sm" color="white" fontWeight="semibold">सोम - शनि</Text>
              </VStack>
              <Box w="1px" h="30px" bg="grey.600" />
              <VStack spacing={0}>
                <Text fontSize="xs" color="grey.400">मौके / हफ्ता</Text>
                <Text fontSize="sm" color="white" fontWeight="semibold">{game2CardState !== 'hidden' ? '2' : '1'}</Text>
              </VStack>
              <Box w="1px" h="30px" bg="grey.600" />
              <VStack spacing={0}>
                <Text fontSize="xs" color="grey.400">रिज़ल्ट</Text>
                <Text fontSize="sm" color="highlight.400" fontWeight="semibold">रविवार</Text>
              </VStack>
            </HStack>

            <HowToPlay />
          </VStack>
        )}

        {/* Hidden video preload — starts buffering while user reads start screen */}
        {preloadVideoId && viewState === 'start' && (
          <Box position="absolute" left="-9999px" w="1px" h="1px" overflow="hidden" aria-hidden="true">
            <iframe
              src={`https://www.youtube.com/embed/${preloadVideoId}?autoplay=1&mute=1&controls=0&playsinline=1&enablejsapi=1&origin=${window.location.origin}${resumeAtSeconds ? `&start=${Math.floor(resumeAtSeconds)}` : ''}`}
              allow="autoplay; encrypted-media"
              style={{ width: '320px', height: '180px', border: 'none' }}
              title="preload"
            />
          </Box>
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
          <SoloGameResults
            onBackToLobby={() => returnToStartScreen('completed')}
            categoryRankings={categoryRankings}
            gameNumber={activeGameNumber}
            game2Status={game2Status ? { ...game2Status, hasPlayed: !!game2Info?.status } : null}
            onPlayTicket2={game2Status?.available && !game2Info?.status ? () => handleEnterGame(2) : undefined}
          />
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
                {/* Video loading overlay — shows thumbnail + spinner while buffering */}
                {videoLoading && (
                  <Box
                    position="absolute"
                    inset={0}
                    bg="grey.900"
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    zIndex={3}
                    transition="opacity 0.3s ease"
                    borderRadius="md"
                    overflow="hidden"
                  >
                    {/* YouTube thumbnail as poster */}
                    <Box
                      position="absolute"
                      inset={0}
                      backgroundImage={`url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)`}
                      backgroundSize="cover"
                      backgroundPosition="center"
                      opacity={0.4}
                    />
                    {!showTapToPlay ? (
                      <>
                        <Spinner size="lg" color="brand.500" thickness="3px" zIndex={1} />
                        <Text color="white" fontSize="xs" mt={2} zIndex={1} fontWeight="medium">
                          वीडियो लोड हो रहा है...
                        </Text>
                      </>
                    ) : (
                      <Box
                        as="button"
                        zIndex={1}
                        bg="brand.500"
                        color="white"
                        borderRadius="full"
                        w="72px"
                        h="72px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="3xl"
                        boxShadow="0 0 20px rgba(37, 141, 88, 0.5)"
                        _hover={{ transform: 'scale(1.1)' }}
                        _active={{ transform: 'scale(0.95)' }}
                        transition="transform 0.15s ease"
                        onClick={() => {
                          playVideo();
                          setVideoLoading(false);
                          setShowTapToPlay(false);
                          trackEvent({
                            eventName: 'solo_autoplay_fallback_tapped',
                            properties: { video_id: videoId },
                          });
                        }}
                      >
                        ▶
                      </Box>
                    )}
                  </Box>
                )}
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

              {/* Right: Refresh Button */}
              <Box
                as="button"
                onClick={() => {
                  // Re-create the YouTube iframe instead of full page reload
                  // (full reload sends user back to the intermediate start screen)
                  const savedVideoId = videoId;
                  if (savedVideoId) {
                    setVideoId(null);
                    requestAnimationFrame(() => {
                      setVideoId(savedVideoId);
                    });
                  }
                }}
                bg="grey.700"
                border="1px solid"
                borderColor="whiteAlpha.400"
                borderRadius="md"
                w="36px"
                h="36px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                _hover={{ bg: 'grey.600' }}
                flexShrink={0}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </Box>
            </HStack>

            {/* Thin progress bar */}
            <Progress value={progress} colorScheme="brand" w="100%" borderRadius="full" size="xs" />

            {/* Live players row */}
            <HStack
              w="100%"
              justify="center"
              align="center"
              bgGradient="linear(to-r, rgba(37,141,88,0.3), rgba(239,167,63,0.2), rgba(37,141,88,0.3))"
              borderRadius="lg"
              px={4}
              py={2}
              spacing={3}
            >
              {/* Overlapping bitmoji avatar faces */}
              <HStack spacing={0}>
                {['player-1', 'player-2', 'player-3', 'player-4', 'player-5'].map((seed, i) => (
                  <Box
                    key={i}
                    w="24px"
                    h="24px"
                    borderRadius="full"
                    border="2px solid"
                    borderColor="grey.900"
                    overflow="hidden"
                    ml={i > 0 ? '-8px' : '0'}
                    zIndex={5 - i}
                    bg="grey.700"
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                      alt=""
                      width="24"
                      height="24"
                      style={{ display: 'block' }}
                    />
                  </Box>
                ))}
                <Box
                  w="24px"
                  h="24px"
                  borderRadius="full"
                  bg="brand.600"
                  border="2px solid"
                  borderColor="grey.900"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  ml="-8px"
                  zIndex={0}
                >
                  <Text fontSize="2xs" color="white" fontWeight="bold">+</Text>
                </Box>
              </HStack>

              {/* Player count */}
              <HStack spacing={1.5}>
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg="#E74C3C"
                  css={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                />
                <Text fontSize="xs" fontWeight="semibold" color="whiteAlpha.800">
                  {livePlayerCount.toLocaleString('en-IN')}+ आपके साथ खेल रहे हैं
                </Text>
              </HStack>
            </HStack>

            {/* Ticket */}
            <SoloTicket ticket={ticket} />

            {/* Claim Buttons */}
            <SoloClaimButtons onClaim={handleClaim} isClaimLoading={claimLoading} categoryRankings={categoryRankings} />

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

      {/* Login wall — fires after the anonymous user's first claim on the
          open web. Navigates to /login?returnTo=/soloGame on tap and stashes
          the anon ID in localStorage for the post-login merge. */}
      {loginWallCategory && (
        <LoginWall
          isOpen={showLoginWall}
          category={loginWallCategory}
          soloGameId={soloGameId}
          numbersCalledAtWin={loginWallNumbersAtWin}
          anonId={loginWallAnonId}
        />
      )}

      {/* Install wall — fires after a logged-in user's first claim on the
          open web. Suppressed in the Stage Flutter app's WebView (they
          already have the app). */}
      {installWallCategory && (
        <InstallWall
          isOpen={showInstallWall}
          category={installWallCategory}
          soloGameId={soloGameId}
          numbersCalledAtWin={installWallNumbersAtWin}
        />
      )}
    </Box>
  );
}
