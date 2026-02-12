import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  Grid,
  GridItem,
  HStack,
  VStack,
  Badge,
  useToast,
  NumberInput,
  NumberInputField,
  Divider,
  Stack,
} from '@chakra-ui/react';
import { apiService } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { Logo } from '../components/Logo';
import { GameSummaryModal } from '../components/GameSummaryModal';
import { useTambolaTracking } from '../hooks/useTambolaTracking';
import { frontendLogger } from '../utils/logger';

interface Winner {
  playerId: string;
  userId?: string;
  category: string;
  userName?: string;
}

export default function GameControl() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { trackEvent } = useTambolaTracking();

  const [game, setGame] = useState<any>(null);
  const [numberToCall, setNumberToCall] = useState('');
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);

  // Track in-flight number calls to prevent duplicates
  const pendingNumberCalls = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!gameId) {
      navigate('/organizer');
      return;
    }

    loadGameData();

    // Join the game room to receive real-time updates
    wsService.joinGame(gameId);

    // Setup WebSocket
    wsService.on({
      onStateSync: (data) => {
        // Sync game state when organizer joins
        console.log('[GameControl] ===== onStateSync called =====');
        console.log('[GameControl] Winners from backend:', data.winners?.length || 0);
        console.log('[GameControl] Current winners before sync:', winners.length);

        setCalledNumbers(data.calledNumbers || []);
        setCurrentNumber(data.currentNumber || null);
        setPlayers(data.players || []);
        setWinners(data.winners || []);

        console.log('[GameControl] ===== onStateSync complete =====');
      },
      onPlayerJoined: (data) => {
        setPlayers((prev) => [...prev, { playerId: data.playerId, userName: data.userName }]);
        toast({
          title: 'Player Joined',
          description: `${data.userName} joined the game`,
          status: 'info',
          duration: 3000,
        });
      },
      onNumberCalled: (data) => {
        setCalledNumbers((prev) => [...prev, data.number]);
        setCurrentNumber(data.number);
      },
      onWinner: (data) => {
        console.log('[GameControl] ===== onWinner called =====');
        console.log('[GameControl] Winner data:', JSON.stringify(data));
        console.log('[GameControl] Current winners before:', winners.length);

        setWinners((prev) => {
          console.log('[GameControl] setWinners prev:', prev.length);
          const newWinners = [...prev, data];
          console.log('[GameControl] setWinners new:', newWinners.length);
          return newWinners;
        });

        const userName = data.userName || 'Someone';
        const categoryName = data.category
          .split('_')
          .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' ');
        toast({
          title: `Winner: ${categoryName}!`,
          description: `${userName} won ${categoryName}!`,
          status: 'success',
          duration: 10000,
        });
      },
      onError: (data) => {
        console.error('Game error:', data);

        // Show error toast to organizer
        toast({
          title: 'Error',
          description: data.message || 'An error occurred',
          status: 'error',
          duration: 10000,
          isClosable: true,
        });

        // Handle specific error codes
        if (data.code === 'FORBIDDEN') {
          toast({
            title: 'Permission Denied',
            description: 'You are not the organizer of this game',
            status: 'error',
            duration: 10000,
          });
          navigate('/organizer');
        }

        if (data.code === 'GAME_NOT_ACTIVE') {
          toast({
            title: 'Game Not Active',
            description: 'This game is not currently active',
            status: 'warning',
            duration: 5000,
          });
          loadGameData();
        }
      },
      onDisconnected: () => {
        toast({
          title: '⚠️ Disconnected',
          description: 'Lost connection to server. Reconnecting...',
          status: 'warning',
          duration: null,
          id: 'disconnected-toast',
        });
      },
      onConnected: () => {
        toast.close('disconnected-toast');
        toast({
          title: '✅ Reconnected',
          description: 'Connection restored',
          status: 'success',
          duration: 3000,
        });
        loadGameData();
        wsService.joinGame(gameId);
      },
    });

    return () => {
      if (gameId) {
        wsService.leaveGame(gameId);
      }
      wsService.off();
    };
  }, [gameId]);

  // DEBUG: Track winners state changes
  useEffect(() => {
    console.log('[GameControl] RENDER - Winners count:', winners.length);
    console.log('[GameControl] RENDER - Winners:', JSON.stringify(winners));
  }, [winners]);

  const loadGameData = async () => {
    frontendLogger.organizerLoadStart();
    try {
      const startTime = Date.now();
      const gameData = await apiService.getGame(gameId!);
      const duration = Date.now() - startTime;

      frontendLogger.apiCall(`/api/v1/games/${gameId}`, 'GET', duration, 200);

      setGame(gameData);
      setCalledNumbers(gameData.calledNumbers || []);
      setCurrentNumber(gameData.currentNumber || null);

      // Set game start time if game is active
      if (gameData.status === 'ACTIVE' && !gameStartTime) {
        setGameStartTime(Date.now());
      }

      // Load existing winners
      if (gameData.winners && gameData.winners.length > 0) {
        setWinners(gameData.winners);
      }

      frontendLogger.organizerLoadComplete({
        status: gameData.status,
        players: players.length,
        calledNumbers: gameData.calledNumbers?.length || 0,
        winners: gameData.winners?.length || 0,
      });
    } catch (error) {
      frontendLogger.error('ORGANIZER_LOAD', error as Error, { gameId });
      toast({
        title: 'Error',
        description: 'Failed to load game data',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCallNumber = async () => {
    const number = parseInt(numberToCall);
    if (!number || number < 1 || number > 90) {
      toast({
        title: 'Invalid Number',
        description: 'Please enter a number between 1 and 90',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Use Set for O(1) duplicate check instead of Array.includes() O(n)
    if (new Set(calledNumbers).has(number)) {
      toast({
        title: 'Already Called',
        description: `Number ${number} has already been called`,
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    // Check if this number is already being called (prevent duplicates)
    if (pendingNumberCalls.current.has(number)) {
      toast({
        title: 'Please Wait',
        description: `Already calling number ${number}...`,
        status: 'info',
        duration: 2000,
      });
      return;
    }

    // Add to pending set
    pendingNumberCalls.current.add(number);

    // Set loading state
    setIsCallingNumber(true);
    setLastCalledNumber(number);

    frontendLogger.organizerCallNumber(gameId!, number);

    try {
      // Wait for backend acknowledgment
      await wsService.callNumber(gameId!, number);

      // Success - clear input ONLY after confirmation
      setNumberToCall('');

      frontendLogger.organizerCallNumberSuccess(number);

      // Show success toast ONLY after confirmation
      toast({
        title: 'Number Called',
        description: `Successfully called number: ${number}`,
        status: 'success',
        duration: 1000,
      });
    } catch (error) {
      // Error - show to organizer
      const errorMessage = error instanceof Error ? error.message : 'Failed to call number';

      frontendLogger.organizerCallNumberError(number, errorMessage);

      toast({
        title: 'Failed to Call Number',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsCallingNumber(false);
      // Remove from pending set
      pendingNumberCalls.current.delete(number);
    }
  };

  const handleCompleteGame = async () => {
    try {
      await apiService.updateGameStatus(gameId!, 'COMPLETED');

      // Track game summary event
      const completionTime = Date.now();
      const totalDurationMinutes = gameStartTime
        ? Math.floor((completionTime - gameStartTime) / (60 * 1000))
        : 0;

      // Calculate completion rate
      const totalPlayersJoined = players.length;
      const totalPlayersCompleted = totalPlayersJoined; // All players who joined are counted as completed
      const completionRatePercentage = totalPlayersJoined > 0
        ? Math.round((totalPlayersCompleted / totalPlayersJoined) * 100)
        : 0;

      trackEvent({
        eventName: 'game_summary',
        properties: {
          game_id: gameId,
          scheduled_time: game?.scheduledTime || new Date().toISOString(),
          actual_start_time: gameStartTime ? new Date(gameStartTime).toISOString() : new Date().toISOString(),
          completion_time: new Date(completionTime).toISOString(),
          total_duration_minutes: totalDurationMinutes,
          total_players_joined: totalPlayersJoined,
          total_players_completed: totalPlayersCompleted,
          completion_rate_percentage: completionRatePercentage,
          winners: winners.map((w) => ({
            player_id: w.playerId,
            app_user_id: w.userId,  // Mobile app userId
            user_name: w.userName,
            category: w.category,
          })),
          total_prizes_distributed: winners.length,
        },
      });

      toast({
        title: 'Game Completed',
        status: 'success',
        duration: 2000,
      });
      // Show summary modal
      setShowSummary(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    navigate('/lobby');
  };

  const getWinnerForCategory = (category: string) => {
    return winners.find((w) => w.category === category);
  };

  if (!game) {
    return (
      <Box w="100vw" h="100vh" display="flex" alignItems="center" justifyContent="center" bg="grey.900">
        <Text color="white">Loading...</Text>
      </Box>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={6} w="100%" align="stretch" p={6}>
        {/* Header */}
        <Box position="relative" w="100%" minH="50px" mb={2}>
          <Box position="absolute" left={0} top={0}>
            <Logo height="28px" />
          </Box>
          <Heading
            size="xl"
            color="white"
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            whiteSpace="nowrap"
          >
            Game Control
          </Heading>
          <Button
            position="absolute"
            top={0}
            right={0}
            variant="outline"
            colorScheme="brand"
            onClick={() => navigate('/organizer')}
            size="sm"
          >
            Back to Organizer
          </Button>
        </Box>

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6} maxW="1600px" w="100%" mx="auto">
          {/* Left Column - Call Number & Grid */}
          <GridItem>
            <VStack align="stretch" spacing={6}>
              {/* Call Number Section */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4} color="grey.900">Call Number</Heading>
                <HStack spacing={3}>
                  <NumberInput
                    value={numberToCall}
                    onChange={(valueString) => setNumberToCall(valueString)}
                    min={1}
                    max={90}
                    flex={1}
                    isDisabled={isCallingNumber}
                  >
                    <NumberInputField
                      placeholder={isCallingNumber ? `Calling ${lastCalledNumber}...` : "Enter number (1-90)"}
                      fontSize="lg"
                      h="50px"
                      color="grey.900"
                      borderColor="grey.300"
                      _placeholder={{ color: 'grey.500' }}
                    />
                  </NumberInput>
                  <Button
                    colorScheme="orange"
                    size="lg"
                    h="50px"
                    px={8}
                    onClick={handleCallNumber}
                    isLoading={isCallingNumber}
                    loadingText={`Calling ${lastCalledNumber}...`}
                    isDisabled={isCallingNumber}
                  >
                    Call Number
                  </Button>
                </HStack>
                {currentNumber && (
                  <Box mt={4} p={4} bg="orange.50" borderRadius="md" textAlign="center">
                    <Text fontSize="sm" color="grey.600" mb={1}>Last Called Number:</Text>
                    <Text fontSize="4xl" fontWeight="bold" color="orange.500">{currentNumber}</Text>
                  </Box>
                )}
              </Box>

              {/* Number Board */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <HStack justify="space-between" mb={4}>
                  <Heading size="md" color="grey.900">Number Board</Heading>
                  <Badge colorScheme="brand" fontSize="md" px={3} py={1}>
                    {calledNumbers.length}/90 Called
                  </Badge>
                </HStack>
                <Grid templateColumns="repeat(10, 1fr)" gap={2}>
                  {(() => {
                    // Create Set once for O(1) lookups instead of O(n) per number
                    const calledNumbersSet = new Set(calledNumbers);
                    return Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
                      const isCalled = calledNumbersSet.has(num);
                      const isCurrent = num === currentNumber;
                    return (
                      <Box
                        key={num}
                        w="100%"
                        h="45px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg={isCurrent ? 'orange.400' : isCalled ? 'brand.500' : 'grey.100'}
                        color={isCalled || isCurrent ? 'white' : 'grey.600'}
                        borderRadius="md"
                        fontWeight={isCalled ? 'bold' : 'normal'}
                        fontSize="lg"
                        border="2px"
                        borderColor={isCurrent ? 'orange.500' : 'transparent'}
                        boxShadow={isCurrent ? 'lg' : 'none'}
                        transition="all 0.2s"
                      >
                        {num}
                      </Box>
                    );
                    });
                  })()}
                </Grid>
              </Box>
            </VStack>
          </GridItem>

          {/* Right Column - Stats & Winners */}
          <GridItem>
            <VStack align="stretch" spacing={6}>
              {/* Game Stats */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4} color="grey.900">Game Stats</Heading>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
                    <Text color="grey.600">Players:</Text>
                    <Text fontWeight="bold" fontSize="xl" color="grey.900">{players.length}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="grey.600">Numbers Called:</Text>
                    <Text fontWeight="bold" fontSize="xl" color="brand.500">{calledNumbers.length}/90</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="grey.600">Winners:</Text>
                    <Text fontWeight="bold" fontSize="xl" color="green.500">{winners.length}/5</Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Win Categories */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4} color="grey.900">Win Categories</Heading>
                <VStack align="stretch" spacing={3}>
                  {[
                    { key: 'EARLY_5', label: 'Early 5' },
                    { key: 'TOP_LINE', label: 'Top Line' },
                    { key: 'MIDDLE_LINE', label: 'Middle Line' },
                    { key: 'BOTTOM_LINE', label: 'Bottom Line' },
                    { key: 'FULL_HOUSE', label: 'Full House' },
                  ].map(({ key, label }) => {
                    const winner = getWinnerForCategory(key);
                    return (
                      <HStack
                        key={key}
                        justify="space-between"
                        p={4}
                        bg={winner ? 'green.50' : 'grey.50'}
                        borderRadius="md"
                        border="2px"
                        borderColor={winner ? 'green.300' : 'grey.200'}
                      >
                        <Text fontWeight="bold" fontSize="lg" color={winner ? 'green.700' : 'grey.700'}>
                          {label}
                        </Text>
                        {winner ? (
                          <VStack align="end" spacing={0}>
                            <Badge colorScheme="green" fontSize="sm" mb={1}>WON ✓</Badge>
                            <Text fontSize="sm" color="green.700" fontWeight="semibold">
                              {winner.userName || 'Unknown Player'}
                            </Text>
                          </VStack>
                        ) : (
                          <Badge colorScheme="grey" fontSize="sm">Pending</Badge>
                        )}
                      </HStack>
                    );
                  })}
                </VStack>
              </Box>

              {/* Actions */}
              <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
                <VStack spacing={3}>
                  <Button
                    w="100%"
                    colorScheme="red"
                    size="lg"
                    onClick={handleCompleteGame}
                  >
                    Complete Game
                  </Button>
                </VStack>
              </Box>
            </VStack>
          </GridItem>
        </Grid>
      </VStack>

      {/* Game Summary Modal */}
      <GameSummaryModal
        isOpen={showSummary}
        onClose={handleCloseSummary}
        winners={winners}
        isOrganizer={true}
      />
    </Box>
  );
}
