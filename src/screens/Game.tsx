import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Text,
  Grid,
  GridItem,
  HStack,
  VStack,
  Badge,
  useToast,
  Divider,
  Center,
  Spinner,
  AspectRatio,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { apiService, type YouTubeLiveStream } from '../services/api.service';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { Ticket } from '../components/Ticket';
import { Logo } from '../components/Logo';
import { GameSummaryModal } from '../components/GameSummaryModal';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { frontendLogger } from '../utils/logger';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();
  const { trackEvent } = useTambolaTracking();
  const [showSummary, setShowSummary] = useState(false);
  const [gameStartTime] = useState<number>(Date.now());
  const [liveStream, setLiveStream] = useState<YouTubeLiveStream | null>(null);
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem('playerName') || '');

  // Wake Lock to prevent screen from sleeping during game
  const wakeLockRef = useRef<any>(null);

  const {
    playerId,
    ticket,
    currentGameId,
    currentNumber,
    calledNumbers,
    winners,
    players,
    addCalledNumber,
    addPlayer,
    addWinner,
    syncGameState,
    getMarkedCount,
    checkLineComplete,
    checkFullHouse,
    clearGame,
  } = useGameStore();

  // Debug: Log when winners change to verify React re-renders
  useEffect(() => {
    console.log('[Game Component] Winners changed! Count:', winners.length);
    console.log('[Game Component] Winners:', JSON.stringify(winners));
  }, [winners]);

  useEffect(() => {
    // Load live stream
    const loadLiveStream = async () => {
      frontendLogger.markStart('loadLiveStream');
      try {
        const stream = await apiService.getCurrentYouTubeLiveStream();
        const duration = frontendLogger.markEnd('loadLiveStream');

        frontendLogger.apiCall('/api/v1/youtube-livestream', 'GET', duration, 200);
        setLiveStream(stream);
      } catch (error) {
        const duration = frontendLogger.markEnd('loadLiveStream');
        frontendLogger.error('LIVESTREAM_LOAD', error as Error, { duration_ms: duration });
      }
    };

    loadLiveStream();
  }, []);

  useEffect(() => {
    if (!gameId) {
      navigate('/lobby', { replace: true });
      return;
    }

    frontendLogger.playerAction('GAME_COMPONENT_MOUNTED', {
      gameId,
      playerId,
      wsConnected: wsService.isConnected(),
      playerName
    });

    // Setup WebSocket event handlers FIRST before joining
    // This ensures handlers are ready to receive stateSync event
    wsService.on({
      onConnected: () => {
        frontendLogger.websocketConnected(wsService.getSocketId() || 'unknown');
        frontendLogger.playerJoinGame(gameId);

        // Join game when WebSocket connects/reconnects
        wsService.joinGame(gameId, playerName);
      },
      onGameJoined: (data) => {
        frontendLogger.playerAction('GAME_JOINED_EVENT', {
          gameId: data.gameId,
          playerId: data.playerId,
          ticketReceived: !!data.ticket,
          winsReceived: (data as any).wins?.length || 0
        });

        // Set ticket and playerId in store
        const { setTicket, addWinner } = useGameStore.getState();
        setTicket(data.playerId, data.ticket, data.gameId);

        // If player has wins (rejoining after claiming), add them to state
        const wins = (data as any).wins;
        if (wins && wins.length > 0) {
          console.log('[Game] Player has existing wins, syncing to state:', wins);
          wins.forEach((category: string) => {
            addWinner({
              playerId: data.playerId,
              category: category as any
            });
          });
        }

        console.log('[Game] Joined game successfully, ticket set:', {
          playerId: data.playerId,
          gameId: data.gameId,
          ticketSize: data.ticket?.length,
          existingWins: wins?.length || 0
        });
      },
      onStateSync: (data) => {
        // Sync game state when rejoining (optimized payload)
        const isOptimized = !!data.playerCount;

        frontendLogger.playerGameStateSync({
          gameId,
          playerId,
          calledNumbersCount: data.calledNumbers.length,
          currentNumber: data.currentNumber,
          playersCount: data.playerCount || data.players.length,
          winnersCount: data.winners.length,
          markedNumbersCount: data.markedNumbers?.length || 0,
          optimized: isOptimized
        });

        // If playerCount provided (optimized), use empty players array
        // Player doesn't need full player list, just their own game state
        syncGameState(
          data.calledNumbers,
          data.currentNumber || null,
          data.players, // Will be empty array if optimized
          data.winners as any,
          data.markedNumbers || []
        );
      },
      onPlayerJoined: (data) => {
        frontendLogger.playerAction('PLAYER_JOINED_EVENT', {
          gameId,
          newPlayerId: data.playerId,
          newPlayerName: data.userName
        });

        addPlayer({ playerId: data.playerId, userName: data.userName });
        toast({
          title: 'खिलाड़ी शामिल हुए',
          description: `${data.userName} गेम में शामिल हुए`,
          status: 'info',
          duration: 3000,
        });
      },
      onGameStarted: () => {
        frontendLogger.playerAction('GAME_STARTED_EVENT', { gameId, playerId });

        toast({
          title: 'गेम शुरू हो गया!',
          description: 'अपने नंबर मार्क करने के लिए तैयार हो जाएं',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      },
      onNumberCalled: (data) => {
        frontendLogger.playerAction('NUMBER_CALLED_EVENT', {
          gameId,
          playerId,
          number: data.number,
          totalCalled: calledNumbers.length + 1
        });

        addCalledNumber(data.number);
      },
      onWinner: (data) => {
        const categoryName = getCategoryLabel(data.category);
        const userName = (data as any).userName || 'कोई';

        frontendLogger.playerAction('WINNER_ANNOUNCED', {
          gameId,
          playerId: data.playerId,
          category: data.category,
          winnerName: userName,
          isMe: data.playerId === playerId
        });

        addWinner(data);

        toast({
          title: `विजेता: ${categoryName}!`,
          description: `${userName} ने ${categoryName} जीता!`,
          status: 'success',
          duration: 10000,
          isClosable: true,
        });
      },
      onWinClaimed: (data) => {
        frontendLogger.playerWinClaimResult(
          data.category,
          data.success,
          data.message || (data.success ? 'Win claimed successfully' : 'Win claim failed')
        );

        if (data.success && playerId) {
          // Add ourselves to winners list to update UI
          addWinner({
            playerId,
            category: data.category as any,
          });

          // Track prize won event
          trackEvent({
            eventName: 'prize_won',
            properties: {
              game_id: gameId,
              player_id: playerId,
              user_name: user?.name || 'Anonymous',
              category: data.category,
              numbers_called_to_win: calledNumbers.length,
              total_players: players.length,
            },
          });

          toast({
            title: 'बधाई हो!',
            description: data.message,
            status: 'success',
            duration: 10000,
            isClosable: true,
          });
        }
      },
      onGameCompleted: () => {
        // Track game completed by user
        const gameDurationMinutes = Math.floor((Date.now() - gameStartTime) / (60 * 1000));
        const didWin = winners.some((w) => w.playerId === playerId);

        frontendLogger.playerAction('GAME_COMPLETED', {
          gameId,
          playerId,
          duration_minutes: gameDurationMinutes,
          marked_numbers: getMarkedCount(),
          did_win: didWin
        });

        trackEvent({
          eventName: 'game_completed_by_user',
          properties: {
            game_id: gameId,
            player_id: playerId,
            user_name: user?.name || 'Anonymous',
            game_duration_minutes: gameDurationMinutes,
            marked_numbers_final: getMarkedCount(),
            did_win: didWin,
          },
        });

        toast({
          title: 'गेम पूर्ण हुआ',
          description: 'आयोजक ने गेम समाप्त कर दिया है। खेलने के लिए धन्यवाद!',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        // Show summary modal
        setShowSummary(true);
      },
      onGameDeleted: (data) => {
        frontendLogger.playerAction('GAME_DELETED_EVENT', {
          gameId,
          playerId,
          message: data.message
        });

        toast({
          title: 'गेम डिलीट हो गया',
          description: data.message || 'गेम आयोजक द्वारा डिलीट कर दिया गया है',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        clearGame();
        navigate('/lobby');
      },
      onError: (error) => {
        frontendLogger.error('GAME_WEBSOCKET_ERROR', new Error(error.message), {
          gameId,
          playerId,
          errorCode: error.code
        });

        // Special handling for game not found (deleted game)
        if (error.code === 'GAME_NOT_FOUND') {
          toast({
            title: 'गेम डिलीट हो गया',
            description: 'गेम आयोजक द्वारा डिलीट कर दिया गया है',
            status: 'warning',
            duration: 5000,
          });
          clearGame();
          navigate('/lobby');
        } else {
          toast({
            title: 'त्रुटि',
            description: error.message,
            status: 'error',
            duration: 5000,
          });
        }
      },
    });

    // If WebSocket is already connected, join immediately
    // Otherwise, onConnected handler above will join when connection is ready
    if (wsService.isConnected()) {
      frontendLogger.playerJoinGame(gameId);
      wsService.joinGame(gameId, playerName);
    } else {
      frontendLogger.websocketConnecting(wsService.getUrl());
    }

    return () => {
      if (gameId) {
        frontendLogger.playerLeaveGame(gameId, playerId || 'unknown');
        wsService.leaveGame(gameId);
      }
      wsService.off();
    };
  }, [gameId]);

  // Wake Lock: Prevent screen from sleeping during game
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          frontendLogger.playerAction('WAKE_LOCK_ACQUIRED', { gameId, playerId });

          wakeLockRef.current.addEventListener('release', () => {
            frontendLogger.playerAction('WAKE_LOCK_RELEASED', { gameId, playerId });
          });
        } else {
          frontendLogger.playerAction('WAKE_LOCK_NOT_SUPPORTED', { gameId, playerId });
        }
      } catch (error) {
        frontendLogger.error('WAKE_LOCK_ACQUIRE', error as Error, { gameId, playerId });
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((error: any) => {
          frontendLogger.error('WAKE_LOCK_RELEASE', error, { gameId, playerId });
        });
      }
    };
  }, []);

  // Visibility change: Auto-reconnect when app returns to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        frontendLogger.playerAction('APP_FOREGROUNDED', {
          gameId,
          playerId,
          wsConnected: wsService.isConnected()
        });

        // If WebSocket disconnected while backgrounded, reconnect
        if (!wsService.isConnected() && gameId) {
          frontendLogger.playerAction('RECONNECTING_AFTER_BACKGROUND', { gameId, playerId });

          toast({
            title: 'पुनः कनेक्ट हो रहा है...',
            description: 'गेम से दोबारा जुड़ रहे हैं',
            status: 'info',
            duration: 2000,
          });

          // Restore state from localStorage if available
          const savedState = localStorage.getItem(`gameState:${gameId}`);
          if (savedState) {
            try {
              const state = JSON.parse(savedState);
              syncGameState(
                state.calledNumbers || [],
                state.currentNumber || null,
                state.players || [],
                state.winners || [],
                state.markedNumbers || []
              );
              frontendLogger.playerAction('STATE_RESTORED_FROM_LOCALSTORAGE', {
                gameId,
                playerId,
                calledNumbers: state.calledNumbers?.length || 0
              });
            } catch (error) {
              frontendLogger.error('STATE_RESTORE_FROM_LOCALSTORAGE', error as Error, { gameId, playerId });
            }
          }

          // Reconnect and rejoin game
          // The onConnected handler will automatically call joinGame
        }

        // Re-request wake lock (may have been released while backgrounded)
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          (navigator as any).wakeLock.request('screen')
            .then((wakeLock: any) => {
              wakeLockRef.current = wakeLock;
              frontendLogger.playerAction('WAKE_LOCK_REACQUIRED', { gameId, playerId });
            })
            .catch((error: any) => {
              frontendLogger.error('WAKE_LOCK_REACQUIRE', error, { gameId, playerId });
            });
        }
      } else {
        frontendLogger.playerAction('APP_BACKGROUNDED', {
          gameId,
          playerId,
          wsConnected: wsService.isConnected()
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameId, syncGameState, toast]);

  // Save game state to localStorage periodically (backup for reconnection)
  useEffect(() => {
    if (!gameId) return;

    const saveInterval = setInterval(() => {
      const state = {
        gameId: currentGameId,
        playerId,
        calledNumbers,
        currentNumber,
        players,
        winners,
        markedNumbers: getMarkedCount ? [] : [], // Placeholder, actual marked numbers tracked in store
      };

      localStorage.setItem(`gameState:${gameId}`, JSON.stringify(state));
    }, 5000); // Save every 5 seconds

    return () => {
      clearInterval(saveInterval);
    };
  }, [gameId, currentGameId, playerId, calledNumbers, currentNumber, players, winners, getMarkedCount]);

  const handleLeaveGame = () => {
    frontendLogger.playerLeaveGame(gameId || 'unknown', playerId || 'unknown');

    if (gameId) {
      wsService.leaveGame(gameId);
    }
    clearGame();
    navigate('/lobby');
  };

  const handleCloseSummary = () => {
    frontendLogger.playerAction('CLOSE_SUMMARY_MODAL', { gameId, playerId });

    setShowSummary(false);
    clearGame();
    navigate('/lobby');
  };

  const handleClaimWin = (category: string) => {
    if (!gameId) return;

    frontendLogger.playerClaimWin(gameId, category);
    wsService.claimWin(gameId, category);
  };

  const handleNumberClick = (number: number) => {
    // Number successfully marked in frontend state, now sync to backend
    if (gameId && playerId) {
      const totalMarked = getMarkedCount();
      frontendLogger.playerMarkNumber(gameId, number, totalMarked);
      wsService.markNumber(gameId, playerId, number);
    }
  };

  const getCategoryWinner = (category: string) => {
    return winners.find((w) => w.category === category);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'EARLY_5': 'पहले पांच',
      'TOP_LINE': 'ऊपर वाली लाइन',
      'MIDDLE_LINE': 'बीच वाली लाइन',
      'BOTTOM_LINE': 'नीचे वाली लाइन',
      'FULL_HOUSE': 'सारे नंबर',
    };
    return labels[category] || category;
  };

  const renderNumberBoard = () => {
    const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
    // Create Set once for O(1) lookups instead of O(n) per number (90 × 67 = 6030 iterations avoided!)
    const calledNumbersSet = new Set(calledNumbers);

    return (
      <Grid templateColumns={{ base: 'repeat(10, minmax(0, 1fr))', md: 'repeat(10, 1fr)' }} gap={{ base: 1, sm: 1.5, md: 2 }}>
        {numbers.map((num) => {
          const isCalled = calledNumbersSet.has(num);
          const isCurrent = num === currentNumber;

          return (
            <GridItem key={num}>
              <Box
                w={{ base: '28px', sm: '32px', md: '40px' }}
                h={{ base: '28px', sm: '32px', md: '40px' }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={isCurrent ? 'orange.400' : isCalled ? 'brand.500' : 'grey.100'}
                color={isCalled || isCurrent ? 'white' : 'grey.500'}
                borderRadius="md"
                fontWeight={isCurrent ? 'bold' : 'normal'}
                fontSize={{ base: isCurrent ? 'sm' : 'xs', sm: isCurrent ? 'md' : 'sm', md: isCurrent ? 'lg' : 'md' }}
                border="2px"
                borderColor={isCurrent ? 'orange.500' : 'transparent'}
                transition="all 0.3s"
                boxShadow={isCurrent ? 'lg' : 'none'}
              >
                {num}
              </Box>
            </GridItem>
          );
        })}
      </Grid>
    );
  };

  // Show loading while waiting for ticket
  if (!ticket) {
    return (
      <Center h="100vh" bg="grey.900">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={{ base: 3, md: 4 }} w="100%" align="stretch" p={{ base: 3, md: 4 }}>
        {/* Header */}
        <Box position="relative" w="100%" minH={{ base: '40px', md: '50px' }} mb={{ base: 1, md: 2 }}>
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
            onClick={handleLeaveGame}
            size={{ base: 'xs', md: 'sm' }}
            borderWidth="2px"
          >
            बाहर निकलें
          </Button>
        </Box>

        {/* Keep Screen On Warning */}
        <Alert status="info" variant="solid" borderRadius="md">
          <AlertIcon />
          <VStack align="start" spacing={0} flex={1}>
            <Text fontSize="sm" fontWeight="bold">
              स्क्रीन जलाए रखें
            </Text>
            <Text fontSize="xs">
              गेम के दौरान कनेक्शन बनाए रखने के लिए कृपया अपनी स्क्रीन ऑन रखें
            </Text>
          </VStack>
        </Alert>

        {/* YouTube Live Stream */}
        {liveStream && (
          <Box w="100%" maxW="600px" mx="auto">
            <AspectRatio ratio={16 / 9}>
              <iframe
                src={`https://www.youtube.com/embed/${liveStream.embedId}?autoplay=1&mute=0`}
                title="YouTube live stream"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  border: '2px solid #E53E3E',
                  borderRadius: '8px',
                }}
              />
            </AspectRatio>
          </Box>
        )}

        {/* Your Ticket */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            आपका टिकट (मार्क करने के लिए नंबर पर क्लिक करें)
          </Heading>
          <Ticket ticket={ticket} showMarked={true} onNumberClick={handleNumberClick} />
        </Box>

        {/* Stats - Compact */}
        <HStack spacing={{ base: 4, md: 6 }} justify="center" w="100%">
          <HStack spacing={2}>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400">मार्क किए गए:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="brand.500">
              {getMarkedCount()}/15
            </Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400">बुलाए गए:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="brand.500">
              {calledNumbers.length}/90
            </Text>
          </HStack>
        </HStack>

        {/* Win Categories */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            जीत की श्रेणियां
          </Heading>
          <VStack align="stretch" spacing={{ base: 2, md: 3 }}>
            {[
              { key: 'EARLY_5', label: 'पहले पांच' },
              { key: 'TOP_LINE', label: 'ऊपर वाली लाइन', lineIndex: 0 },
              { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन', lineIndex: 1 },
              { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन', lineIndex: 2 },
              { key: 'FULL_HOUSE', label: 'सारे नंबर' },
            ].map(({ key, label, lineIndex }) => {
              const winner = getCategoryWinner(key);
              const isMyWin = winner && winner.playerId === playerId;
              const isComplete =
                lineIndex !== undefined
                  ? checkLineComplete(lineIndex)
                  : key === 'FULL_HOUSE'
                  ? checkFullHouse()
                  : getMarkedCount() >= 5;

              return (
                <HStack key={key} justify="space-between" p={{ base: 3, md: 4 }} bg="white" borderRadius="md" border="1px" borderColor="grey.300" spacing={2}>
                  <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="grey.900">{label}</Text>
                  {winner ? (
                    <Badge colorScheme={isMyWin ? "green" : "red"} fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>
                      {isMyWin ? 'आपने जीता ✓' : 'किसी और ने जीता'}
                    </Badge>
                  ) : isComplete ? (
                    <Button
                      size={{ base: 'sm', md: 'md' }}
                      colorScheme="yellow"
                      onClick={() => handleClaimWin(key)}
                      px={{ base: 4, md: 6 }}
                    >
                      जीत का दावा करें
                    </Button>
                  ) : (
                    <Badge colorScheme="grey" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>प्रगति में</Badge>
                  )}
                </HStack>
              );
            })}
          </VStack>
        </Box>

        {/* Number Board */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            नंबर बोर्ड
          </Heading>
          {renderNumberBoard()}
        </Box>

        {/* Winners */}
        {winners.length > 0 && (
          <Box w="100%" maxW="600px" mx="auto">
            <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
              विजेता
            </Heading>
            <VStack align="stretch" spacing={2}>
              {winners.map((winner, index) => (
                <HStack key={index} justify="space-between" p={{ base: 2, md: 3 }} bg="green.50" borderRadius="md" spacing={2}>
                  <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="semibold" color="green.700">
                    {getCategoryLabel(winner.category)}
                  </Text>
                  <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.600">
                    {winner.userName || 'खिलाड़ी'}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>

      {/* Game Summary Modal */}
      <GameSummaryModal
        isOpen={showSummary}
        onClose={handleCloseSummary}
        winners={winners}
        isOrganizer={false}
      />
    </Box>
  );
}
