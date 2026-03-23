import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Center,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Badge,
  useToast,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { apiService, type WeeklyPlayerState } from '../services/api.service';
import { useAuthStore } from '../stores/authStore';
import { Logo } from '../components/Logo';
import { useTambolaTracking } from '../hooks/useTambolaTracking';

const CATEGORIES = [
  { key: 'EARLY_5', label: 'पहले पांच', lineIndex: undefined },
  { key: 'TOP_LINE', label: 'ऊपर वाली लाइन', lineIndex: 0 },
  { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन', lineIndex: 1 },
  { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन', lineIndex: 2 },
  { key: 'FULL_HOUSE', label: 'सारे नंबर', lineIndex: undefined },
];

const DRIP_INTERVAL = 15; // seconds between each number shown to user

export default function WeeklyGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();
  const { trackEvent } = useTambolaTracking();
  const mountTimeRef = useRef<number>(Date.now());

  const [state, setState] = useState<WeeklyPlayerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [claimingCategory, setClaimingCategory] = useState<string | null>(null);

  // Frontend drip animation state
  const [shownCount, setShownCount] = useState<number>(0); // how many of todayNumbers we've shown
  const [countdown, setCountdown] = useState<number>(DRIP_INTERVAL);
  const dripTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dripStartTimeRef = useRef<number>(0);

  const userId = user?.id || localStorage.getItem('app_user_id') || '';
  const userName = user?.name || localStorage.getItem('playerName') || 'Player';

  const getDaysLeft = (resultDate?: string | null) => {
    if (!resultDate) return null;
    return Math.max(0, Math.ceil((new Date(resultDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  };

  const loadState = useCallback(async () => {
    if (!gameId || !userId) return;
    try {
      const data = await apiService.getWeeklyPlayerState(gameId, userId);
      setState(data);
      setHasJoined(true);
      // Track game viewed
      trackEvent({ eventName: 'individual_game_viewed', properties: {
        game_id: gameId,
        revealed_count: data.revealedNumbers.length,
        today_numbers_count: data.todayNumbers?.length || 0,
        marked_count: data.player.markedNumbers.length,
        days_left: getDaysLeft(data.game.resultDate),
      }});
    } catch (error: any) {
      if (error.message?.includes('Player not found')) {
        // Auto-join the game
        try {
          await apiService.joinWeeklyGame(gameId, userId, userName);
          const data = await apiService.getWeeklyPlayerState(gameId, userId);
          setState(data);
          setHasJoined(true);
          // Track game joined (first time)
          trackEvent({ eventName: 'individual_game_joined', properties: {
            game_id: gameId,
            user_name: userName,
            revealed_count: data.revealedNumbers.length,
            days_left: getDaysLeft(data.game.resultDate),
          }});
        } catch (joinError: any) {
          toast({ title: 'Error', description: joinError.message, status: 'error', duration: 3000 });
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [gameId, userId, userName, toast, trackEvent]);

  useEffect(() => { loadState(); }, [loadState]);

  // Reload state every 60s to catch new daily batches
  useEffect(() => {
    if (!hasJoined) return;
    const interval = setInterval(loadState, 60_000);
    return () => clearInterval(interval);
  }, [hasJoined, loadState]);

  // Frontend drip timer: show todayNumbers one by one
  useEffect(() => {
    if (!state) return;
    const todayNums = state.todayNumbers || [];
    if (todayNums.length === 0) return;

    // On first load, start showing from 0
    // If user already saw all, show all immediately
    const totalToShow = todayNums.length;

    // Clear previous timers
    if (dripTimerRef.current) clearInterval(dripTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Start drip: reveal one number every DRIP_INTERVAL seconds
    dripStartTimeRef.current = Date.now();
    setShownCount(1); // show first number immediately
    setCountdown(DRIP_INTERVAL);

    // Track drip started
    trackEvent({ eventName: 'individual_drip_started', properties: {
      game_id: gameId,
      today_numbers_count: totalToShow,
      revealed_count: state.revealedNumbers.length,
    }});

    if (totalToShow <= 1) return; // only 1 number, nothing to drip

    const dripStartedAt = Date.now();
    dripTimerRef.current = setInterval(() => {
      setShownCount((prev) => {
        const next = prev + 1;
        if (next >= totalToShow) {
          // All shown, clear drip timer
          if (dripTimerRef.current) clearInterval(dripTimerRef.current);
          // Track drip completed
          trackEvent({ eventName: 'individual_drip_completed', properties: {
            game_id: gameId,
            today_numbers_count: totalToShow,
            time_spent_seconds: Math.round((Date.now() - dripStartedAt) / 1000),
          }});
          return totalToShow;
        }
        dripStartTimeRef.current = Date.now(); // reset countdown anchor
        return next;
      });
    }, DRIP_INTERVAL * 1000);

    // Countdown ticks
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - dripStartTimeRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(DRIP_INTERVAL - elapsed));
      setCountdown(remaining);
    }, 250);

    return () => {
      if (dripTimerRef.current) clearInterval(dripTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [state?.todayNumbers?.length, state?.game?.revealedCount]);

  const handleMarkNumber = async (number: number) => {
    if (!gameId || !userId) return;
    try {
      await apiService.markWeeklyNumber(gameId, number, userId);
      trackEvent({ eventName: 'individual_number_marked', properties: {
        game_id: gameId,
        number,
        marked_count: (state?.player.markedNumbers.length || 0) + 1,
        revealed_count: state?.revealedNumbers.length || 0,
      }});
      await loadState();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 2000 });
    }
  };

  const handleClaim = async (category: string) => {
    if (!gameId || !userId || claimingCategory) return;
    setClaimingCategory(category);
    trackEvent({ eventName: 'individual_claim_attempted', properties: {
      game_id: gameId,
      category,
      marked_count: state?.player.markedNumbers.length || 0,
      revealed_count: state?.revealedNumbers.length || 0,
    }});
    try {
      const result = await apiService.claimWeeklyWin(gameId, category, userId);
      trackEvent({ eventName: 'individual_claim_result', properties: {
        game_id: gameId,
        category,
        success: true,
        completed_at_call: (result as any)?.completedAtCall || null,
      }});
      await loadState();
      toast({ title: 'जीत का दावा सफल!', status: 'success', duration: 3000 });
    } catch (error: any) {
      trackEvent({ eventName: 'individual_claim_result', properties: {
        game_id: gameId,
        category,
        success: false,
        completed_at_call: null,
      }});
      toast({ title: 'Error', description: error.message, status: 'error', duration: 3000 });
    } finally {
      setClaimingCategory(null);
    }
  };

  if (isLoading) {
    return (
      <Center h="100vh" w="100vw">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  if (!state) return null;

  const { game, player, revealedNumbers, todayNumbers, claims, wonCategories } = state;
  const ticket = player.ticket as number[][];
  const markedSet = new Set(player.markedNumbers);
  const ticketNumbers = ticket.flat().filter((n) => n !== 0);
  const markedCount = player.markedNumbers.length;
  const claimedCategories = new Set(claims.map((c) => c.category));

  const resultDate = game.resultDate ? new Date(game.resultDate) : null;
  const isResultTime = resultDate ? new Date() > resultDate : false;
  const daysLeft = resultDate
    ? Math.max(0, Math.ceil((resultDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Today's numbers shown so far (frontend drip)
  const visibleTodayNumbers = (todayNumbers || []).slice(0, shownCount);
  const currentNumber = visibleTodayNumbers.length > 0 ? visibleTodayNumbers[visibleTodayNumbers.length - 1] : null;
  const allTodayShown = shownCount >= (todayNumbers || []).length;

  // Visible revealed set: previous days' numbers + only dripped today numbers
  // (so the 90-number board marks numbers progressively as they drip)
  const todaySet = new Set(todayNumbers || []);
  const visibleTodaySet = new Set(visibleTodayNumbers);
  const visibleRevealedSet = new Set(
    revealedNumbers.filter((n) => !todaySet.has(n) || visibleTodaySet.has(n))
  );

  const getRowNumbers = (rowIdx: number) => ticket[rowIdx].filter((n) => n !== 0);
  const checkLineComplete = (rowIdx: number) => getRowNumbers(rowIdx).every((n) => markedSet.has(n));
  const checkFullHouse = () => ticketNumbers.every((n) => markedSet.has(n));
  const canClaim = (cat: string, lineIndex?: number) => {
    if (claimedCategories.has(cat)) return false;
    if (cat === 'EARLY_5') return markedCount >= 5;
    if (cat === 'FULL_HOUSE') return checkFullHouse();
    return lineIndex !== undefined && checkLineComplete(lineIndex);
  };

  const cellSize = { base: '35px', sm: '45px', md: '60px' };
  const fontSize = { base: 'md', sm: 'lg', md: 'xl' };

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
            onClick={() => {
              trackEvent({ eventName: 'individual_game_exited', properties: {
                game_id: gameId,
                marked_count: state?.player.markedNumbers.length || 0,
                revealed_count: state?.revealedNumbers.length || 0,
                time_spent_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
              }});
              navigate('/lobby');
            }}
            size={{ base: 'xs', md: 'sm' }}
            borderWidth="2px"
          >
            बाहर निकलें
          </Button>
        </Box>

        {/* Game Info Banner */}
        <Alert status="info" variant="left-accent" borderRadius="md" bg="blue.50" borderColor="blue.400">
          <AlertIcon color="blue.500" />
          <VStack align="start" spacing={0} flex={1}>
            <Text fontSize="sm" fontWeight="bold" color="blue.900">
              {revealedNumbers.length}/90 नंबर आए
            </Text>
            <Text fontSize="xs" color="blue.800">
              {isResultTime
                ? 'परिणाम उपलब्ध हैं!'
                : daysLeft !== null
                ? `${daysLeft} दिन बाकी | हर रोज़ 15 नंबर`
                : 'हर रोज़ 15 नंबर आएंगे'}
            </Text>
          </VStack>
        </Alert>

        {/* Current Number + Countdown Timer */}
        {currentNumber && (
          <Box w="100%" maxW="600px" mx="auto" bg="brand.900" borderRadius="lg" p={4} border="2px solid" borderColor="brand.500">
            <HStack justify="space-between" align="center" px={{ base: 2, md: 4 }}>
              {/* Current number — left/center */}
              <VStack spacing={1} flex={1}>
                <Text color="brand.200" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                  ताज़ा नंबर
                </Text>
                <Box
                  w={{ base: '70px', md: '90px' }}
                  h={{ base: '70px', md: '90px' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg="orange.400"
                  color="white"
                  borderRadius="full"
                  fontWeight="bold"
                  fontSize={{ base: '3xl', md: '4xl' }}
                  boxShadow="0 0 20px rgba(237, 137, 54, 0.6)"
                >
                  {currentNumber}
                </Box>
              </VStack>

              {/* Countdown to next number — right side */}
              {!allTodayShown && (
                <VStack spacing={1}>
                  <Text color="brand.200" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                    अगला नंबर
                  </Text>
                  <Box
                    w={{ base: '50px', md: '60px' }}
                    h={{ base: '50px', md: '60px' }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg="whiteAlpha.200"
                    border="2px solid"
                    borderColor="orange.400"
                    borderRadius="md"
                  >
                    <Text color="white" fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold">
                      {countdown}s
                    </Text>
                  </Box>
                </VStack>
              )}
            </HStack>

            <Box mt={3} py={2} px={3} bg="whiteAlpha.100" borderRadius="md">
              <Text color="orange.200" fontSize="sm" fontWeight="semibold" textAlign="center">
                {allTodayShown
                  ? `आज के सभी ${todayNumbers?.length || 0} नंबर आ चुके हैं`
                  : `आज के नंबर: ${shownCount}/${todayNumbers?.length || 0} — निकले हुए नंबर देखने के लिए नीचे नंबर बोर्ड देखें`}
              </Text>
            </Box>
          </Box>
        )}

        {/* No numbers today message */}
        {(!todayNumbers || todayNumbers.length === 0) && (
          <Box w="100%" maxW="600px" mx="auto" bg="grey.800" borderRadius="lg" p={4} textAlign="center">
            <Text color="grey.400" fontSize="sm">
              आज के नंबर अभी नहीं आए हैं। कृपया बाद में वापस आएं।
            </Text>
          </Box>
        )}

        {/* Ticket */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            आपका टिकट (मार्क करने के लिए नंबर पर क्लिक करें)
          </Heading>
          <Box border="2px" borderColor="brand.500" borderRadius="md" p={{ base: 2, sm: 3, md: 4 }} bg="white" boxShadow="md">
            {ticket.map((row, rowIndex) => (
              <Grid
                key={rowIndex}
                templateColumns={{ base: 'repeat(9, minmax(0, 1fr))', md: 'repeat(9, 1fr)' }}
                gap={{ base: 1, sm: 1.5, md: 2 }}
                mb={rowIndex < 2 ? { base: 1, sm: 1.5, md: 2 } : 0}
              >
                {row.map((cell, colIndex) => {
                  const isEmpty = cell === 0;
                  const isMarked = !isEmpty && markedSet.has(cell);
                  const isRevealed = !isEmpty && visibleRevealedSet.has(cell);
                  const canMark = !isEmpty && isRevealed && !isMarked;

                  return (
                    <GridItem key={`${rowIndex}-${colIndex}`}>
                      <Box
                        w={cellSize}
                        h={cellSize}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg={isEmpty ? 'grey.100' : isMarked ? 'brand.500' : canMark ? 'orange.100' : 'white'}
                        border={canMark ? '2px solid' : '1px solid'}
                        borderColor={isEmpty ? 'grey.200' : canMark ? 'orange.400' : 'brand.300'}
                        borderRadius="md"
                        fontWeight="bold"
                        fontSize={fontSize}
                        color={isEmpty ? 'transparent' : isMarked ? 'white' : 'grey.900'}
                        transition="all 0.2s"
                        cursor={canMark ? 'pointer' : 'default'}
                        onClick={() => canMark && handleMarkNumber(cell)}
                        _hover={canMark ? { transform: 'scale(1.05)', boxShadow: 'md', bg: 'orange.200' } : {}}
                      >
                        <Text>{isEmpty ? '' : cell}</Text>
                      </Box>
                    </GridItem>
                  );
                })}
              </Grid>
            ))}
          </Box>
        </Box>

        {/* Stats */}
        <HStack spacing={{ base: 4, md: 6 }} justify="center" w="100%">
          <HStack spacing={2}>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400">मार्क किए गए:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="brand.500">{markedCount}/15</Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.400">नंबर आए:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="brand.500">{revealedNumbers.length}/90</Text>
          </HStack>
        </HStack>

        {/* Win Categories */}
        <Box w="100%" maxW="600px" mx="auto">
          <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
            जीत की श्रेणियां
          </Heading>
          <VStack align="stretch" spacing={{ base: 2, md: 3 }}>
            {CATEGORIES.map(({ key, label, lineIndex }) => {
              const claimed = claimedCategories.has(key);
              const wonBySomeone = wonCategories.includes(key);
              const isComplete = canClaim(key, lineIndex);
              const isAvailable = !wonBySomeone || claimed;

              return (
                <HStack
                  key={key}
                  justify="space-between"
                  p={{ base: 3, md: 4 }}
                  bg={isAvailable ? 'white' : 'grey.50'}
                  borderRadius="md"
                  border="1px"
                  borderColor={isAvailable ? 'grey.300' : 'grey.200'}
                  spacing={2}
                  opacity={isAvailable ? 1 : 0.7}
                >
                  <VStack align="start" spacing={0}>
                    <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="grey.900">{label}</Text>
                    {!isAvailable && !claimed && (
                      <Text fontSize={{ base: '2xs', sm: 'xs' }} color="grey.600">पहले ही जीत लिया गया</Text>
                    )}
                  </VStack>
                  {claimed ? (
                    <Badge colorScheme="green" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>आपने जीता ✓</Badge>
                  ) : wonBySomeone ? (
                    <Badge colorScheme="red" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>किसी और ने जीता</Badge>
                  ) : isComplete ? (
                    <Button
                      size={{ base: 'sm', md: 'md' }}
                      colorScheme="yellow"
                      onClick={() => handleClaim(key)}
                      isLoading={claimingCategory === key}
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
          <Grid templateColumns="repeat(10, 1fr)" gap={{ base: 1, md: 1.5 }}>
            {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
              const isRevealed = visibleRevealedSet.has(num);
              const isCurrent = num === currentNumber;
              return (
                <GridItem key={num}>
                  <Box
                    h={{ base: '28px', md: '36px' }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg={isCurrent ? 'orange.400' : isRevealed ? 'brand.500' : 'grey.100'}
                    color={isRevealed || isCurrent ? 'white' : 'grey.500'}
                    borderRadius="sm"
                    fontSize={{ base: 'xs', md: 'sm' }}
                    fontWeight={isCurrent ? 'bold' : 'normal'}
                  >
                    {num}
                  </Box>
                </GridItem>
              );
            })}
          </Grid>
        </Box>

        {/* Results */}
        {isResultTime && claims.length > 0 && (
          <Box w="100%" maxW="600px" mx="auto">
            <Heading size={{ base: 'xs', md: 'sm' }} mb={{ base: 2, md: 3 }} color="white" textAlign="center">
              विजेता
            </Heading>
            <VStack align="stretch" spacing={2}>
              {claims.map((claim, index) => (
                <HStack key={index} justify="space-between" p={{ base: 2, md: 3 }} bg="green.50" borderRadius="md" spacing={2}>
                  <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="semibold" color="green.700">
                    {CATEGORIES.find((c) => c.key === claim.category)?.label || claim.category}
                  </Text>
                  <Badge colorScheme="green">आपने दावा किया</Badge>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
