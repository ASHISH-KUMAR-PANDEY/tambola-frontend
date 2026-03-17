import { useEffect, useState, useCallback } from 'react';
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

const CATEGORIES = [
  { key: 'EARLY_5', label: 'पहले पांच', lineIndex: undefined },
  { key: 'TOP_LINE', label: 'ऊपर वाली लाइन', lineIndex: 0 },
  { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन', lineIndex: 1 },
  { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन', lineIndex: 2 },
  { key: 'FULL_HOUSE', label: 'सारे नंबर', lineIndex: undefined },
];

export default function WeeklyGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();

  const [state, setState] = useState<WeeklyPlayerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
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
      }
    } finally {
      setIsLoading(false);
    }
  }, [gameId, userId]);

  useEffect(() => { loadState(); }, [loadState]);

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
    if (!gameId || !userId) return;
    try {
      await apiService.markWeeklyNumber(gameId, number, userId);
      await loadState();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 2000 });
    }
  };

  const handleClaim = async (category: string) => {
    if (!gameId || !userId || claimingCategory) return;
    setClaimingCategory(category);
    try {
      await apiService.claimWeeklyWin(gameId, category, userId);
      await loadState();
      toast({ title: 'जीत का दावा सफल!', status: 'success', duration: 3000 });
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

  if (!hasJoined) {
    return (
      <Center h="100vh" w="100vw" bg="grey.900">
        <VStack spacing={6}>
          <Heading color="white" size="lg">WEEKLY TAMBOLA</Heading>
          <Text color="grey.400" textAlign="center" maxW="300px">
            इस साप्ताहिक गेम में शामिल हों! हर रोज़ 15 नंबर आएंगे।
          </Text>
          <Button colorScheme="brand" size="lg" onClick={handleJoin} isLoading={isJoining}>
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

  const { game, player, revealedNumbers, todayNumbers, currentNumber, claims, wonCategories } = state;
  const ticket = player.ticket as number[][];
  const markedSet = new Set(player.markedNumbers);
  const revealedSet = new Set(revealedNumbers);
  const ticketNumbers = ticket.flat().filter((n) => n !== 0);
  const markedCount = player.markedNumbers.length;
  const claimedCategories = new Set(claims.map((c) => c.category));

  const resultDate = game.resultDate ? new Date(game.resultDate) : null;
  const isResultTime = resultDate ? new Date() > resultDate : false;
  const daysLeft = resultDate
    ? Math.max(0, Math.ceil((resultDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

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
            onClick={() => navigate('/individual')}
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
              साप्ताहिक गेम — {revealedNumbers.length}/90 नंबर आए
            </Text>
            <Text fontSize="xs" color="blue.800">
              {isResultTime
                ? 'परिणाम उपलब्ध हैं!'
                : daysLeft !== null
                ? `${daysLeft} दिन बाकी | हर रोज़ 15 नंबर रात 12 बजे`
                : 'हर रोज़ 15 नंबर रात 12 बजे आएंगे'}
            </Text>
          </VStack>
        </Alert>

        {/* Today's Numbers */}
        {todayNumbers && todayNumbers.length > 0 && (
          <Box w="100%" maxW="600px" mx="auto" bg="brand.900" borderRadius="lg" p={4} border="2px solid" borderColor="brand.500">
            <Text color="brand.200" fontSize="sm" fontWeight="bold" mb={2} textAlign="center">
              आज के नंबर ({todayNumbers.length})
            </Text>
            <HStack flexWrap="wrap" gap={2} justify="center">
              {todayNumbers.map((num) => (
                <Box
                  key={num}
                  w={{ base: '36px', md: '44px' }}
                  h={{ base: '36px', md: '44px' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={markedSet.has(num) ? 'brand.500' : 'white'}
                  color={markedSet.has(num) ? 'white' : 'grey.900'}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize={{ base: 'sm', md: 'md' }}
                  cursor={!markedSet.has(num) && ticketNumbers.includes(num) ? 'pointer' : 'default'}
                  onClick={() => !markedSet.has(num) && ticketNumbers.includes(num) && revealedSet.has(num) && handleMarkNumber(num)}
                  border="2px solid"
                  borderColor={markedSet.has(num) ? 'brand.600' : ticketNumbers.includes(num) ? 'orange.400' : 'grey.300'}
                  _hover={!markedSet.has(num) && ticketNumbers.includes(num) ? { bg: 'orange.100' } : {}}
                >
                  {num}
                </Box>
              ))}
            </HStack>
          </Box>
        )}

        {/* Missed Numbers Banner */}
        {player.missedNumbers.length > 0 && (
          <Alert status="warning" variant="left-accent" borderRadius="md" bg="orange.50" borderColor="orange.400">
            <AlertIcon color="orange.500" />
            <VStack align="start" spacing={1} flex={1}>
              <Text fontSize="sm" fontWeight="bold" color="orange.900">
                छूटे हुए नंबर — अभी मार्क करें!
              </Text>
              <HStack flexWrap="wrap" gap={1}>
                {player.missedNumbers.map((num) => (
                  <Button key={num} size="xs" colorScheme="orange" onClick={() => handleMarkNumber(num)} minW="32px">
                    {num}
                  </Button>
                ))}
              </HStack>
            </VStack>
          </Alert>
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
                  const isRevealed = !isEmpty && revealedSet.has(cell);
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
              const isRevealed = revealedSet.has(num);
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
