import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Center,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  useToast,
  Badge,
  Grid,
  GridItem,
  Divider,
} from '@chakra-ui/react';
import { apiService, type WeeklyPlayerState } from '../services/api.service';
import { useAuthStore } from '../stores/authStore';
import { Ticket } from '../components/Ticket';

const CATEGORY_LABELS: Record<string, string> = {
  EARLY_5: 'पहले पांच',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

export default function WeeklyGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();

  const [state, setState] = useState<WeeklyPlayerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [markingNumber, setMarkingNumber] = useState<number | null>(null);
  const [claimingCategory, setClaimingCategory] = useState<string | null>(null);

  const userId = user?.id || localStorage.getItem('app_user_id') || '';
  const userName = user?.name || localStorage.getItem('playerName') || 'Player';

  const loadState = useCallback(async () => {
    if (!gameId || !userId) return;
    try {
      const data = await apiService.getWeeklyPlayerState(gameId, userId);
      setState(data);
      setHasJoined(true);
    } catch (error: any) {
      if (error.message?.includes('Player not found')) {
        setHasJoined(false);
      } else {
        console.error('Failed to load state:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [gameId, userId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Auto-refresh every 60 seconds to catch new number reveals
  useEffect(() => {
    if (!hasJoined) return;
    const interval = setInterval(loadState, 60_000);
    return () => clearInterval(interval);
  }, [hasJoined, loadState]);

  const handleJoin = async () => {
    if (!gameId || !userId) return;
    setIsJoining(true);
    try {
      await apiService.joinWeeklyGame(gameId, userId, userName);
      setHasJoined(true);
      await loadState();
      toast({ title: 'गेम में शामिल हो गए!', status: 'success', duration: 2000 });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 3000 });
    } finally {
      setIsJoining(false);
    }
  };

  const handleMarkNumber = async (number: number) => {
    if (!gameId || !userId || markingNumber) return;
    setMarkingNumber(number);
    try {
      await apiService.markWeeklyNumber(gameId, number, userId);
      await loadState();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 2000 });
    } finally {
      setMarkingNumber(null);
    }
  };

  const handleClaim = async (category: string) => {
    if (!gameId || !userId || claimingCategory) return;
    setClaimingCategory(category);
    try {
      await apiService.claimWeeklyWin(gameId, category, userId);
      await loadState();
      toast({ title: 'जीत का दावा सफल!', description: CATEGORY_LABELS[category], status: 'success', duration: 3000 });
    } catch (error: any) {
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

  // Join screen
  if (!hasJoined) {
    return (
      <Center h="100vh" w="100vw" bg="grey.900">
        <VStack spacing={6}>
          <Heading color="white" size="lg">WEEKLY TAMBOLA</Heading>
          <Text color="grey.400" textAlign="center" maxW="300px">
            इस साप्ताहिक गेम में शामिल हों! हर कुछ घंटों में एक नया नंबर आएगा।
          </Text>
          <Button
            colorScheme="brand"
            size="lg"
            onClick={handleJoin}
            isLoading={isJoining}
            loadingText="शामिल हो रहे हैं..."
          >
            गेम में शामिल हों
          </Button>
          <Button variant="ghost" color="grey.400" onClick={() => navigate('/individual')}>
            वापस जाएं
          </Button>
        </VStack>
      </Center>
    );
  }

  if (!state) return null;

  const {
    game,
    player,
    revealedNumbers,
    currentNumber,
    claims,
    wonCategories,
  } = state;

  const markedSet = new Set(player.markedNumbers);
  const revealedSet = new Set(revealedNumbers);
  const ticketNumbers = (player.ticket as number[][]).flat().filter((n) => n !== 0);
  const markedCount = player.markedNumbers.length;
  const resultDate = game.resultDate ? new Date(game.resultDate) : null;
  const isResultTime = resultDate ? new Date() > resultDate : false;
  const claimedCategories = new Set(claims.map((c) => c.category));

  // Check win conditions
  const ticket = player.ticket as number[][];
  const checkLineComplete = (rowIndex: number) => {
    const rowNums = ticket[rowIndex].filter((n) => n !== 0);
    return rowNums.every((n) => markedSet.has(n));
  };
  const checkFullHouse = () => ticketNumbers.every((n) => markedSet.has(n));

  const canClaim = (cat: string) => {
    if (claimedCategories.has(cat)) return false;
    switch (cat) {
      case 'EARLY_5': return markedCount >= 5;
      case 'TOP_LINE': return checkLineComplete(0);
      case 'MIDDLE_LINE': return checkLineComplete(1);
      case 'BOTTOM_LINE': return checkLineComplete(2);
      case 'FULL_HOUSE': return checkFullHouse();
      default: return false;
    }
  };

  return (
    <Box w="100vw" minH="100vh" bg="grey.900" p={{ base: 3, md: 4 }}>
      <VStack spacing={4} w="100%" maxW="600px" mx="auto">
        {/* Header */}
        <HStack w="100%" justify="space-between" align="center">
          <Heading size={{ base: 'md', md: 'lg' }} color="white">
            WEEKLY TAMBOLA
          </Heading>
          <Button
            variant="outline"
            colorScheme="green"
            size="xs"
            onClick={loadState}
          >
            Refresh
          </Button>
        </HStack>

        {/* Game Info */}
        <HStack w="100%" justify="space-between" flexWrap="wrap" gap={2}>
          <Badge colorScheme="purple" fontSize="xs">
            {revealedNumbers.length}/90 नंबर
          </Badge>
          <Badge colorScheme="blue" fontSize="xs">
            हर {game.revealIntervalMin} मिनट
          </Badge>
          {resultDate && (
            <Badge colorScheme={isResultTime ? 'green' : 'orange'} fontSize="xs">
              {isResultTime ? 'परिणाम उपलब्ध' : `परिणाम: ${resultDate.toLocaleDateString('hi-IN')}`}
            </Badge>
          )}
        </HStack>

        {/* Current Number */}
        {currentNumber && (
          <Box
            w="100%"
            bg="brand.500"
            borderRadius="lg"
            p={4}
            textAlign="center"
          >
            <Text color="white" fontSize="sm">आज का नंबर</Text>
            <Text color="white" fontSize="4xl" fontWeight="bold">{currentNumber}</Text>
          </Box>
        )}

        {/* Missed Numbers */}
        {player.missedNumbers.length > 0 && (
          <Box w="100%" bg="orange.900" borderRadius="lg" p={3}>
            <Text color="orange.200" fontSize="sm" mb={2}>
              छूटे हुए नंबर - अभी मार्क करें:
            </Text>
            <HStack flexWrap="wrap" gap={2}>
              {player.missedNumbers.map((num) => (
                <Button
                  key={num}
                  size="sm"
                  colorScheme="orange"
                  variant="solid"
                  onClick={() => handleMarkNumber(num)}
                  isLoading={markingNumber === num}
                  minW="40px"
                >
                  {num}
                </Button>
              ))}
            </HStack>
          </Box>
        )}

        {/* Ticket */}
        <Box w="100%">
          <Text color="grey.400" fontSize="sm" mb={1}>
            आपका टिकट (मार्क किए: {markedCount}/15)
          </Text>
          <Box
            bg="white"
            borderRadius="md"
            p={2}
            overflowX="auto"
          >
            <Grid templateColumns="repeat(9, 1fr)" gap={1}>
              {ticket.map((row, rowIdx) =>
                row.map((num, colIdx) => {
                  const isEmpty = num === 0;
                  const isMarked = !isEmpty && markedSet.has(num);
                  const isRevealed = !isEmpty && revealedSet.has(num);
                  const canMark = !isEmpty && isRevealed && !isMarked;

                  return (
                    <GridItem
                      key={`${rowIdx}-${colIdx}`}
                      bg={
                        isEmpty ? 'gray.100' :
                        isMarked ? 'green.500' :
                        isRevealed ? 'yellow.200' :
                        'white'
                      }
                      color={isMarked ? 'white' : 'black'}
                      borderRadius="sm"
                      p={1}
                      textAlign="center"
                      fontSize={{ base: 'xs', md: 'sm' }}
                      fontWeight={isMarked ? 'bold' : 'normal'}
                      cursor={canMark ? 'pointer' : 'default'}
                      onClick={() => canMark && handleMarkNumber(num)}
                      border={canMark ? '2px solid' : '1px solid'}
                      borderColor={canMark ? 'orange.400' : 'gray.200'}
                      minH="32px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      _hover={canMark ? { bg: 'orange.100' } : {}}
                    >
                      {isEmpty ? '' : num}
                    </GridItem>
                  );
                })
              )}
            </Grid>
          </Box>
          <HStack mt={1} gap={3} fontSize="xs">
            <HStack><Box w={3} h={3} bg="green.500" borderRadius="sm" /> <Text color="grey.400">मार्क किया</Text></HStack>
            <HStack><Box w={3} h={3} bg="yellow.200" borderRadius="sm" /> <Text color="grey.400">मार्क करें</Text></HStack>
            <HStack><Box w={3} h={3} bg="white" border="1px solid" borderColor="gray.200" borderRadius="sm" /> <Text color="grey.400">अभी नहीं आया</Text></HStack>
          </HStack>
        </Box>

        <Divider borderColor="grey.700" />

        {/* Win Categories */}
        <Box w="100%">
          <Text color="grey.400" fontSize="sm" mb={2}>जीत की श्रेणियां</Text>
          <VStack spacing={2} w="100%">
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const claimed = claimedCategories.has(cat);
              const won = wonCategories.includes(cat);
              const ready = canClaim(cat);

              return (
                <HStack key={cat} w="100%" justify="space-between" bg="grey.800" p={3} borderRadius="md">
                  <Text color="white" fontSize="sm">{label}</Text>
                  {claimed ? (
                    <Badge colorScheme="green">आपने दावा किया</Badge>
                  ) : won ? (
                    <Badge colorScheme="red">किसी और ने दावा किया</Badge>
                  ) : ready ? (
                    <Button
                      size="xs"
                      colorScheme="yellow"
                      onClick={() => handleClaim(cat)}
                      isLoading={claimingCategory === cat}
                    >
                      जीत का दावा करें
                    </Button>
                  ) : (
                    <Badge colorScheme="gray">प्रगति में</Badge>
                  )}
                </HStack>
              );
            })}
          </VStack>
        </Box>

        {/* Number Board */}
        <Box w="100%">
          <Text color="grey.400" fontSize="sm" mb={2}>नंबर बोर्ड ({revealedNumbers.length}/90)</Text>
          <Grid templateColumns="repeat(10, 1fr)" gap={1}>
            {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
              const isRevealed = revealedSet.has(num);
              const isCurrent = num === currentNumber;
              return (
                <GridItem
                  key={num}
                  bg={isCurrent ? 'orange.400' : isRevealed ? 'brand.500' : 'grey.800'}
                  color={isRevealed ? 'white' : 'grey.600'}
                  borderRadius="sm"
                  p={0.5}
                  textAlign="center"
                  fontSize="xs"
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                >
                  {num}
                </GridItem>
              );
            })}
          </Grid>
        </Box>

        {/* Back Button */}
        <Button
          variant="outline"
          colorScheme="red"
          size="sm"
          onClick={() => navigate('/individual')}
          w="100%"
        >
          बाहर निकलें
        </Button>
      </VStack>
    </Box>
  );
}
