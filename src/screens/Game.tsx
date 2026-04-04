import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Text,
  Grid,
  GridItem,
  HStack,
  VStack,
  useToast,
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
import { GameSummaryModal } from '../components/GameSummaryModal';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { frontendLogger } from '../utils/logger';

// ─── Styles ─────────────────────────────────────────────────────────────────
const gameStyles = `
  @keyframes pulse-number {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,162,51,0.7); }
    50%       { box-shadow: 0 0 0 10px rgba(255,162,51,0); }
  }
  .number-pulse { animation: pulse-number 1.8s ease-in-out infinite; }
`;

// ─── Shared Cell (ticket + number board) ────────────────────────────────────
const Cell = ({
  value,
  isCurrent,
  isGreen,   // marked (ticket) or called (board)
  isBlank,
  onClick,
}: {
  value: number;
  isCurrent?: boolean;
  isGreen?: boolean;
  isBlank?: boolean;
  onClick?: () => void;
}) => {
  if (isBlank) {
    return (
      <Box
        h={{ base: '30px', sm: '34px' }}
        borderRadius="6px"
        bg="rgba(227,202,255,0.12)"
      />
    );
  }
  return (
    <Box
      h={{ base: '30px', sm: '34px' }}
      display="flex" alignItems="center" justifyContent="center"
      borderRadius="6px"
      bg={isCurrent ? '#FFA233' : isGreen ? '#248B3B' : '#E3CAFF'}
      className={isCurrent ? 'number-pulse' : ''}
      cursor={onClick ? 'pointer' : 'default'}
      transition="all 0.15s"
      _active={onClick ? { transform: 'scale(0.92)' } : {}}
      onClick={onClick}
    >
      <Text
        fontSize={{ base: '11px', sm: '12px' }}
        fontWeight={isCurrent || isGreen ? '800' : '700'}
        color={isCurrent || isGreen ? 'white' : '#3D1F5E'}
        lineHeight="1"
        userSelect="none"
      >
        {value}
      </Text>
    </Box>
  );
};

// ─── Category row ────────────────────────────────────────────────────────────
const CategoryRow = ({
  label,
  winner,
  isMyWin,
  isComplete,
  isAvailable,
  isLast,
  onClaim,
}: {
  label: string;
  winner: any;
  isMyWin: boolean;
  isComplete: boolean;
  isAvailable: boolean;
  isLast?: boolean;
  onClaim: () => void;
}) => (
  <HStack
    justify="space-between"
    px="16px"
    py="14px"
    borderBottom={!isLast ? '1px solid rgba(0,0,0,0.07)' : 'none'}
    opacity={isAvailable ? 1 : 0.55}
  >
    <Text fontSize="14px" fontWeight="600" color="#1A1A2E">{label}</Text>

    {winner ? (
      <Box px="10px" py="5px" borderRadius="20px" bg={isMyWin ? '#248B3B' : 'rgba(0,0,0,0.08)'}>
        <Text fontSize="11px" fontWeight="700" color={isMyWin ? 'white' : '#666'}>
          {isMyWin ? '✓ Claimed' : 'किसी और ने जीता'}
        </Text>
      </Box>
    ) : isComplete && isAvailable ? (
      <Button
        size="xs"
        bg="linear-gradient(90deg, #FF6B2C, #FFA233)"
        color="white"
        fontWeight="800"
        borderRadius="20px"
        px="14px"
        fontSize="12px"
        h="30px"
        onClick={onClaim}
        _hover={{ opacity: 0.9 }}
        _active={{ transform: 'scale(0.95)' }}
        boxShadow="0 2px 10px rgba(255,107,44,0.35)"
      >
        दावा करें 🎉
      </Button>
    ) : (
      <Box px="10px" py="5px" borderRadius="20px" bg="rgba(255,162,51,0.12)" border="1px solid rgba(255,162,51,0.3)">
        <Text fontSize="11px" fontWeight="600" color="#FFA233">
          {!isAvailable ? 'जीत लिया' : 'प्राप्ति पर है...'}
        </Text>
      </Box>
    )}
  </HStack>
);

// ─── Ticket ──────────────────────────────────────────────────────────────────
const GameTicket = ({
  ticket,
  currentNumber,
  calledNumbers,
  onNumberClick,
}: {
  ticket: number[][];
  currentNumber: number | null;
  calledNumbers: number[];
  onNumberClick: (n: number) => void;
}) => {
  const { isNumberMarked, markNumber } = useGameStore();
  const toast = useToast();

  const handleCell = (cell: number) => {
    if (cell === 0) return;
    try {
      markNumber(cell);
      onNumberClick(cell);
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (err) {
      if (err instanceof Error && err.message === 'NUMBER_NOT_CALLED') {
        toast({
          title: 'अभी नहीं बुलाया',
          description: `नंबर ${cell} अभी नहीं बुलाया गया`,
          status: 'warning',
          duration: 2000,
        });
      }
    }
  };

  return (
    <Box>
      {ticket.map((row, rowIdx) => (
        <Grid
          key={rowIdx}
          templateColumns="repeat(9, 1fr)"
          gap="4px"
          mb={rowIdx < 2 ? '4px' : 0}
        >
          {row.map((cell, colIdx) => (
            <Cell
              key={`${rowIdx}-${colIdx}`}
              value={cell}
              isBlank={cell === 0}
              isCurrent={cell !== 0 && cell === currentNumber}
              isGreen={cell !== 0 && isNumberMarked(cell)}
              onClick={cell !== 0 ? () => handleCell(cell) : undefined}
            />
          ))}
        </Grid>
      ))}
    </Box>
  );
};

// ─── Number board ─────────────────────────────────────────────────────────────
const NumberBoard = ({
  calledNumbers,
  currentNumber,
}: {
  calledNumbers: number[];
  currentNumber: number | null;
}) => {
  const calledSet = new Set(calledNumbers);
  return (
    <Grid templateColumns="repeat(10, 1fr)" gap="3px">
      {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => (
        <Cell
          key={num}
          value={num}
          isCurrent={num === currentNumber}
          isGreen={calledSet.has(num)}
        />
      ))}
    </Grid>
  );
};

// ─── Avatar colours ──────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#FF6B2C', '#FFA233', '#248B3B', '#6B4EFF', '#E53E3E', '#00B5D8'];

// ─── Main Game Screen ────────────────────────────────────────────────────────
export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();
  const { trackEvent } = useTambolaTracking();
  const [showSummary, setShowSummary] = useState(false);
  const [gameStartTime] = useState<number>(Date.now());
  const [liveStream, setLiveStream] = useState<YouTubeLiveStream | null>(null);
  const [playerName] = useState(() => sessionStorage.getItem('playerName') || '');
  const wakeLockRef = useRef<any>(null);

  const {
    playerId,
    ticket,
    currentGameId,
    currentNumber,
    calledNumbers,
    winners,
    players,
    isMidGameJoin,
    calledNumbersAtJoin,
    availablePrizes,
    addCalledNumber,
    addPlayer,
    addWinner,
    syncGameState,
    getMarkedCount,
    checkLineComplete,
    checkFullHouse,
    clearGame,
  } = useGameStore();

  console.log('[Game] winners:', winners.length);
  useEffect(() => { console.log('[Game] winners changed:', winners.length); }, [winners]);

  useEffect(() => {
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
    if (!gameId) { navigate('/lobby', { replace: true }); return; }

    frontendLogger.playerAction('GAME_COMPONENT_MOUNTED', { gameId, playerId, wsConnected: wsService.isConnected(), playerName });

    wsService.on({
      onConnected: () => {
        frontendLogger.websocketConnected(wsService.getSocketId() || 'unknown');
        frontendLogger.playerJoinGame(gameId);
        wsService.joinGame(gameId, playerName);
      },
      onGameJoined: (data) => {
        frontendLogger.playerAction('GAME_JOINED_EVENT', { gameId: data.gameId, playerId: data.playerId, ticketReceived: !!data.ticket, winsReceived: data.wins?.length || 0, isMidGameJoin: data.isMidGameJoin || false, calledNumbersCount: data.calledNumbersCount || 0 });
        const { setTicket, addWinner } = useGameStore.getState();
        setTicket(data.playerId, data.ticket, data.gameId, data.isMidGameJoin, data.calledNumbersCount);
        if (data.wins?.length) {
          data.wins.forEach((category: string) => addWinner({ playerId: data.playerId, category: category as any }));
        }
        trackEvent({ eventName: 'game_joined', properties: { game_id: data.gameId, player_id: data.playerId, user_name: playerName || user?.name || 'Anonymous', player_count: players.length || 0, is_mid_game_join: data.isMidGameJoin || false, called_numbers_count: data.calledNumbersCount || 0 } });
      },
      onStateSync: (data) => {
        const isOptimized = !!data.playerCount;
        frontendLogger.playerGameStateSync({ gameId, playerId, calledNumbersCount: data.calledNumbers.length, currentNumber: data.currentNumber, playersCount: data.playerCount || data.players.length, winnersCount: data.winners.length, markedNumbersCount: data.markedNumbers?.length || 0, optimized: isOptimized, isMidGameJoin: data.isMidGameJoin || false, availablePrizesCount: data.availablePrizes ? Object.values(data.availablePrizes).filter(Boolean).length : 5 });
        syncGameState(data.calledNumbers, data.currentNumber || null, data.players, data.winners as any, data.markedNumbers || [], data.availablePrizes, data.isMidGameJoin);
      },
      onPlayerJoined: (data) => {
        frontendLogger.playerAction('PLAYER_JOINED_EVENT', { gameId, newPlayerId: data.playerId, newPlayerName: data.userName });
        addPlayer({ playerId: data.playerId, userName: data.userName });
      },
      onGameStarted: () => {
        frontendLogger.playerAction('GAME_STARTED_EVENT', { gameId, playerId });
        toast({ title: 'गेम शुरू हो गया!', description: 'अपने नंबर मार्क करने के लिए तैयार हो जाएं', status: 'success', duration: 5000, isClosable: true });
      },
      onNumberCalled: (data) => {
        frontendLogger.playerAction('NUMBER_CALLED_EVENT', { gameId, playerId, number: data.number, totalCalled: calledNumbers.length + 1 });
        addCalledNumber(data.number);
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
      },
      onWinner: (data) => {
        const categoryName = getCategoryLabel(data.category);
        const userName = (data as any).userName || 'कोई';
        frontendLogger.playerAction('WINNER_ANNOUNCED', { gameId, playerId: data.playerId, category: data.category, winnerName: userName, isMe: data.playerId === playerId });
        addWinner(data);
        toast({ title: `विजेता: ${categoryName}!`, description: `${userName} ने ${categoryName} जीता!`, status: 'success', duration: 10000, isClosable: true });
      },
      onWinClaimed: (data) => {
        console.log('[Game] win claimed:', JSON.stringify(data));
        frontendLogger.playerWinClaimResult(data.category, data.success, data.message || (data.success ? 'Win claimed' : 'Win claim failed'));
        if (data.success) {
          const winnerPlayerId = (data as any).playerId || playerId;
          if (!winnerPlayerId) return;
          addWinner({ playerId: winnerPlayerId, category: data.category as any });
          trackEvent({ eventName: 'prize_won', properties: { game_id: gameId, player_id: playerId, user_name: user?.name || 'Anonymous', category: data.category, numbers_called_to_win: calledNumbers.length, total_players: players.length } });
          toast({ title: 'बधाई हो!', description: data.message, status: 'success', duration: 10000, isClosable: true });
        }
      },
      onGameCompleted: () => {
        const gameDurationMinutes = Math.floor((Date.now() - gameStartTime) / 60000);
        const didWin = winners.some((w) => w.playerId === playerId);
        frontendLogger.playerAction('GAME_COMPLETED', { gameId, playerId, duration_minutes: gameDurationMinutes, marked_numbers: getMarkedCount(), did_win: didWin });
        trackEvent({ eventName: 'game_completed_by_user', properties: { game_id: gameId, player_id: playerId, user_name: user?.name || 'Anonymous', game_duration_minutes: gameDurationMinutes, marked_numbers_final: getMarkedCount(), did_win: didWin } });
        toast({ title: 'गेम पूर्ण हुआ', description: 'आयोजक ने गेम समाप्त कर दिया। खेलने के लिए धन्यवाद!', status: 'info', duration: 3000, isClosable: true });
        setShowSummary(true);
      },
      onGameDeleted: (data) => {
        frontendLogger.playerAction('GAME_DELETED_EVENT', { gameId, playerId, message: data.message });
        toast({ title: 'गेम डिलीट हो गया', description: data.message || 'गेम आयोजक द्वारा डिलीट कर दिया गया', status: 'warning', duration: 5000, isClosable: true });
        clearGame();
        navigate('/lobby');
      },
      onError: (error) => {
        frontendLogger.error('GAME_WEBSOCKET_ERROR', new Error(error.message), { gameId, playerId, errorCode: error.code });
        if (error.code === 'GAME_NOT_FOUND') {
          toast({ title: 'गेम डिलीट हो गया', description: 'गेम आयोजक द्वारा डिलीट कर दिया गया', status: 'warning', duration: 5000 });
          clearGame();
          navigate('/lobby');
        } else {
          toast({ title: 'त्रुटि', description: error.message, status: 'error', duration: 5000 });
        }
      },
    });

    if (wsService.isConnected()) {
      frontendLogger.playerJoinGame(gameId);
      wsService.joinGame(gameId, playerName);
    } else {
      frontendLogger.websocketConnecting(wsService.getUrl());
    }

    return () => {
      if (gameId) { frontendLogger.playerLeaveGame(gameId); wsService.leaveGame(gameId); }
      wsService.off();
    };
  }, [gameId]);

  // Wake lock
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => frontendLogger.playerAction('WAKE_LOCK_RELEASED', { gameId, playerId }));
        }
      } catch (e) { frontendLogger.error('WAKE_LOCK_ACQUIRE', e as Error, { gameId, playerId }); }
    };
    acquire();
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, []);

  // Visibility / reconnect
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        frontendLogger.playerAction('APP_FOREGROUNDED', { gameId, playerId, wsConnected: wsService.isConnected() });
        if (!wsService.isConnected() && gameId) {
          toast({ title: 'पुनः कनेक्ट हो रहा है...', status: 'info', duration: 2000 });
          try {
            const saved = localStorage.getItem(`gameState:${gameId}`);
            if (saved) {
              const s = JSON.parse(saved);
              syncGameState(s.calledNumbers || [], s.currentNumber || null, s.players || [], s.winners || [], s.markedNumbers || []);
            }
          } catch { /* ignore */ }
        }
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          (navigator as any).wakeLock.request('screen').then((wl: any) => { wakeLockRef.current = wl; }).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [gameId, syncGameState, toast]);

  // Periodic state save
  useEffect(() => {
    if (!gameId) return;
    const id = setInterval(() => {
      localStorage.setItem(`gameState:${gameId}`, JSON.stringify({ gameId: currentGameId, playerId, calledNumbers, currentNumber, players, winners, markedNumbers: [] }));
    }, 5000);
    return () => clearInterval(id);
  }, [gameId, currentGameId, playerId, calledNumbers, currentNumber, players, winners]);

  const handleLeaveGame = () => {
    frontendLogger.playerLeaveGame(gameId || 'unknown');
    if (gameId) wsService.leaveGame(gameId);
    clearGame();
    navigate('/lobby');
  };

  const handleClaimWin = (category: string) => {
    if (!gameId) return;
    frontendLogger.playerClaimWin(gameId, category);
    wsService.claimWin(gameId, category);
  };

  const handleNumberClick = (number: number) => {
    if (gameId && playerId) {
      frontendLogger.playerMarkNumber(gameId, number, getMarkedCount());
      wsService.markNumber(gameId, playerId, number);
    }
  };

  const getCategoryWinner = (cat: string) => winners.find((w) => w.category === cat);

  const getCategoryLabel = (cat: string) => ({
    'EARLY_5':      'पहले पांच',
    'TOP_LINE':     'ऊपर वाली लाइन',
    'MIDDLE_LINE':  'बीच वाली लाइन',
    'BOTTOM_LINE':  'नीचे वाली लाइन',
    'FULL_HOUSE':   'सारे नंबर',
  }[cat] || cat);

  const categories = [
    { key: 'EARLY_5',     label: 'पहले पांच' },
    { key: 'TOP_LINE',    label: 'ऊपर वाली लाइन',  lineIndex: 0 },
    { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन',   lineIndex: 1 },
    { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन',  lineIndex: 2 },
    { key: 'FULL_HOUSE',  label: 'सारे नंबर' },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!ticket) {
    return (
      <Center h="100dvh" bg="#0E0A0A">
        <VStack spacing={4}>
          <Spinner size="xl" color="#FFA233" thickness="4px" />
          <Text color="rgba(255,255,255,0.4)" fontSize="sm">गेम में जुड़ रहे हैं...</Text>
        </VStack>
      </Center>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box w="100vw" minH="100dvh" bg="#0E0A0A" overflowX="hidden">
      <style>{gameStyles}</style>

      {/* Sunburst bg */}
      <Box
        position="fixed" top={0} left={0} w="100%" h="100%"
        pointerEvents="none" zIndex={0}
        backgroundImage="url('/lobby-bg.svg')"
        backgroundSize="cover" backgroundPosition="center top"
        opacity={0.4}
      />

      <VStack
        spacing={0}
        w="100%" maxW="412px" mx="auto"
        pb="40px"
        position="relative" zIndex={1}
        align="stretch"
      >
        {/* ── "LIVE TAMBOLA" header ── */}
        <Box px="16px" pt="52px" pb="10px">
          <Text
            fontSize="20px" fontWeight="900"
            color="#FFD700"
            letterSpacing="2px" textTransform="uppercase"
            textAlign="center"
          >
            Live Tambola
          </Text>
        </Box>

        {/* ── Video / commentary panel ── */}
        <Box px="16px">
          <Box
            w="100%" borderRadius="16px" overflow="hidden"
            bg="#0A0015" border="1px solid rgba(255,255,255,0.08)"
          >
            {/* Video area */}
            <Box h="185px" bg="#0A0015" position="relative">
              {liveStream ? (
                <AspectRatio ratio={16 / 9} h="185px">
                  <iframe
                    src={`https://www.youtube.com/embed/${liveStream.embedId}?autoplay=1&mute=0`}
                    title="Live stream"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ borderRadius: 0 }}
                  />
                </AspectRatio>
              ) : (
                <Center h="185px" flexDirection="column" gap="6px" opacity={0.3}>
                  <Text fontSize="32px" color="white">▶</Text>
                  <Text fontSize="12px" color="white" letterSpacing="2px">LIVE</Text>
                </Center>
              )}

              {/* Back button overlay */}
              <Box
                position="absolute" top="12px" left="12px"
                w="32px" h="32px" borderRadius="full"
                bg="rgba(0,0,0,0.55)"
                display="flex" alignItems="center" justifyContent="center"
                cursor="pointer"
                onClick={handleLeaveGame}
              >
                <Text fontSize="16px" color="white" lineHeight="1">←</Text>
              </Box>
            </Box>

            {/* Bottom bar: count · current number · reconnect */}
            <Box
              px="16px" py="10px"
              bg="rgba(0,0,0,0.75)"
              display="flex" alignItems="center" justifyContent="space-between"
            >
              <Text fontSize="15px" fontWeight="700" color="rgba(255,255,255,0.8)" letterSpacing="0.5px">
                {calledNumbers.length}/90
              </Text>

              <Box
                w="46px" h="46px" borderRadius="full"
                bg={currentNumber ? '#FFA233' : 'rgba(255,162,51,0.25)'}
                display="flex" alignItems="center" justifyContent="center"
                className={currentNumber ? 'number-pulse' : ''}
                boxShadow={currentNumber ? '0 0 16px rgba(255,162,51,0.5)' : 'none'}
              >
                {currentNumber ? (
                  <Text fontSize="20px" fontWeight="900" color="white" lineHeight="1">{currentNumber}</Text>
                ) : (
                  <Text fontSize="11px" color="rgba(255,255,255,0.4)" textAlign="center" lineHeight="1.2">—</Text>
                )}
              </Box>

              <Box
                w="32px" h="32px" borderRadius="full"
                bg="rgba(255,255,255,0.1)"
                display="flex" alignItems="center" justifyContent="center"
                cursor="pointer"
              >
                <Text fontSize="16px" color="rgba(255,255,255,0.6)" lineHeight="1">↻</Text>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Player count ── */}
        {players.length > 0 && (
          <HStack px="16px" pt="12px" pb="4px" spacing="6px">
            <HStack spacing="-6px">
              {AVATAR_COLORS.map((color, i) => (
                <Box
                  key={i}
                  w="22px" h="22px" borderRadius="full"
                  bg={color} border="2px solid #0E0A0A"
                  zIndex={AVATAR_COLORS.length - i}
                />
              ))}
            </HStack>
            <Text fontSize="12px" color="rgba(255,255,255,0.5)" fontWeight="500">
              {players.length}+ लोग आपके साथ इस खेल में मौजूद हैं
            </Text>
          </HStack>
        )}

        {/* ── Alerts ── */}
        {isMidGameJoin && calledNumbersAtJoin > 0 && (
          <Box px="16px" pt="10px">
            <Alert status="warning" borderRadius="10px" bg="rgba(255,162,51,0.1)" border="1px solid rgba(255,162,51,0.3)" py="8px">
              <AlertIcon color="#FFA233" boxSize="16px" />
              <VStack align="start" spacing={0} flex={1}>
                <Text fontSize="12px" fontWeight="700" color="#FFA233">गेम के बीच में शामिल हुए</Text>
                <Text fontSize="11px" color="rgba(255,255,255,0.5)">{calledNumbersAtJoin} नंबर पहले ही बुलाए जा चुके हैं</Text>
              </VStack>
            </Alert>
          </Box>
        )}

        {calledNumbers.length === 0 && !isMidGameJoin && (
          <Box px="16px" pt="10px">
            <Alert status="info" borderRadius="10px" bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.1)" py="8px">
              <AlertIcon color="rgba(255,255,255,0.4)" boxSize="16px" />
              <VStack align="start" spacing={0} flex={1}>
                <Text fontSize="12px" fontWeight="700" color="rgba(255,255,255,0.7)">गेम शुरू होने का इंतजार</Text>
                <Text fontSize="11px" color="rgba(255,255,255,0.4)">आयोजक जल्द ही शुरू करेंगे</Text>
              </VStack>
            </Alert>
          </Box>
        )}

        {/* ── Divider ── */}
        <Box mx="16px" my="16px" h="1px" bg="rgba(255,255,255,0.1)" />

        {/* ── Ticket ── */}
        <Box px="16px">
          <Text fontSize="16px" fontWeight="700" color="white" textAlign="center" mb="12px">
            आपका टिकट
          </Text>
          <GameTicket
            ticket={ticket}
            currentNumber={currentNumber}
            calledNumbers={calledNumbers}
            onNumberClick={handleNumberClick}
          />
        </Box>

        {/* ── Divider ── */}
        <Box mx="16px" my="18px" h="1px" bg="rgba(255,255,255,0.1)" />

        {/* ── Win categories ── */}
        <Box px="16px">
          <Text fontSize="16px" fontWeight="700" color="white" textAlign="center" mb="12px">
            जीत की श्रेणियाँ
          </Text>
          <Box bg="white" borderRadius="14px" overflow="hidden" boxShadow="0 4px 20px rgba(0,0,0,0.3)">
            {categories.map(({ key, label, lineIndex }, idx) => {
              const winner = getCategoryWinner(key);
              const isMyWin = !!(winner && winner.playerId === playerId);
              const isComplete =
                lineIndex !== undefined
                  ? checkLineComplete(lineIndex)
                  : key === 'FULL_HOUSE'
                  ? checkFullHouse()
                  : getMarkedCount() >= 5;
              const isAvailable = !!availablePrizes[key as keyof typeof availablePrizes];
              return (
                <CategoryRow
                  key={key}
                  label={label}
                  winner={winner}
                  isMyWin={isMyWin}
                  isComplete={isComplete}
                  isAvailable={isAvailable}
                  isLast={idx === categories.length - 1}
                  onClaim={() => handleClaimWin(key)}
                />
              );
            })}
          </Box>
        </Box>

        {/* ── Divider ── */}
        <Box mx="16px" my="18px" h="1px" bg="rgba(255,255,255,0.1)" />

        {/* ── Number board ── */}
        <Box px="16px">
          <NumberBoard calledNumbers={calledNumbers} currentNumber={currentNumber} />
        </Box>

        {/* ── Winners list ── */}
        {winners.length > 0 && (
          <>
            <Box mx="16px" my="18px" h="1px" bg="rgba(255,255,255,0.1)" />
            <Box px="16px">
              <Text fontSize="16px" fontWeight="700" color="white" textAlign="center" mb="12px">
                विजेता
              </Text>
              <Box bg="white" borderRadius="14px" overflow="hidden" boxShadow="0 4px 20px rgba(0,0,0,0.3)">
                {winners.map((winner, idx) => (
                  <HStack
                    key={idx}
                    justify="space-between" px="16px" py="13px"
                    borderBottom={idx < winners.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none'}
                  >
                    <Text fontSize="14px" fontWeight="600" color="#1A1A2E">
                      {getCategoryLabel(winner.category)}
                    </Text>
                    <Text fontSize="12px" color="#666">{winner.userName || 'खिलाड़ी'}</Text>
                  </HStack>
                ))}
              </Box>
            </Box>
          </>
        )}
      </VStack>

      <GameSummaryModal
        isOpen={showSummary}
        onClose={() => { setShowSummary(false); clearGame(); navigate('/lobby'); }}
        winners={winners}
        isOrganizer={false}
      />
    </Box>
  );
}
