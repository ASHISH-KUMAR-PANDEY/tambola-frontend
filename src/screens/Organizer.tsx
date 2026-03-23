import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  HStack,
  useToast,
  Divider,
  NumberInput,
  NumberInputField,
  Select,
  Text,
  Badge,
} from '@chakra-ui/react';
import { apiService } from '../services/api.service';
import { useGameStore } from '../stores/gameStore';
import { Logo } from '../components/Logo';

type GameType = 'LIVE' | 'WEEKLY';

export default function Organizer() {
  const navigate = useNavigate();
  const toast = useToast();
  const { setCurrentGame } = useGameStore();

  const [gameType, setGameType] = useState<GameType>('LIVE');
  const [isCreating, setIsCreating] = useState(false);

  // Common prize state
  const [early5Prize, setEarly5Prize] = useState(100);
  const [topLinePrize, setTopLinePrize] = useState(200);
  const [middleLinePrize, setMiddleLinePrize] = useState(200);
  const [bottomLinePrize, setBottomLinePrize] = useState(200);
  const [fullHousePrize, setFullHousePrize] = useState(500);

  // Live game state
  const [scheduledTime, setScheduledTime] = useState('');

  // Weekly game state
  const [numbersPerDay, setNumbersPerDay] = useState(15);
  const [totalDays, setTotalDays] = useState(6);
  const [resultDate, setResultDate] = useState('');

  // Weekly games list
  const [weeklyGames, setWeeklyGames] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadWeeklyGames = useCallback(async () => {
    try {
      const res = await apiService.getWeeklyGames();
      setWeeklyGames(res);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadWeeklyGames(); }, [loadWeeklyGames]);

  const handleCompleteWeekly = async (gameId: string) => {
    setCompletingId(gameId);
    try {
      await apiService.updateWeeklyGameStatus(gameId, { status: 'COMPLETED' });
      toast({ title: 'Game completed', status: 'success', duration: 2000 });
      loadWeeklyGames();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', status: 'error', duration: 3000 });
    } finally { setCompletingId(null); }
  };

  const handleDeleteWeekly = async (gameId: string) => {
    if (!window.confirm('Delete this weekly game? This cannot be undone.')) return;
    setDeletingId(gameId);
    try {
      await apiService.deleteWeeklyGame(gameId);
      toast({ title: 'Game deleted', status: 'success', duration: 2000 });
      loadWeeklyGames();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', status: 'error', duration: 3000 });
    } finally { setDeletingId(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    const prizes = {
      early5: early5Prize,
      topLine: topLinePrize,
      middleLine: middleLinePrize,
      bottomLine: bottomLinePrize,
      fullHouse: fullHousePrize,
    };

    try {
      if (gameType === 'LIVE') {
        const game = await apiService.createGame({
          scheduledTime: scheduledTime || new Date().toISOString(),
          prizes,
        });
        toast({ title: 'Live Game Created!', description: 'Returning to lobby...', status: 'success', duration: 2000 });
        setCurrentGame(game);
        setTimeout(() => navigate('/lobby'), 500);
      } else {
        if (!resultDate) {
          toast({ title: 'Error', description: 'Result date is required', status: 'error', duration: 3000 });
          setIsCreating(false);
          return;
        }
        // revealIntervalMin is now treated as seconds between each number reveal
        await apiService.createWeeklyGame({
          prizes,
          revealIntervalMin: 8, // 8 seconds between each number
          resultDate: new Date(resultDate).toISOString(),
        });
        toast({ title: 'Weekly Game Created!', status: 'success', duration: 2000 });
        loadWeeklyGames();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create game',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={6} w="100%" align="stretch" p={6}>
        {/* Header */}
        <VStack spacing={2} w="100%">
          <HStack w="100%" justify="space-between" align="center">
            <Logo height="28px" />
            <Button
              variant="outline"
              colorScheme="brand"
              onClick={() => navigate('/lobby')}
              size="sm"
            >
              Back to Lobby
            </Button>
          </HStack>
          <Heading size={{ base: 'lg', md: 'xl' }} color="white" textAlign="center">
            TAMBOLA - Organizer
          </Heading>
        </VStack>

        <Box maxW="600px" w="100%" mx="auto">
          {/* Solo Week Setup Button */}
          <Button
            colorScheme="highlight"
            variant="outline"
            onClick={() => navigate('/solo-management')}
            size="md"
            w="100%"
            mb={4}
          >
            Solo Week Setup
          </Button>

          <Box
            p={{ base: 4, md: 6 }}
            bg="white"
            borderRadius="lg"
            boxShadow="md"
            border="1px"
            borderColor="grey.200"
          >
            <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 4, md: 6 }} color="grey.900">
              Create New Game
            </Heading>

            <form onSubmit={handleSubmit}>
              <VStack spacing={4} align="stretch">
                {/* Game Type Selector */}
                <FormControl>
                  <FormLabel color="grey.900" fontWeight="semibold">Game Type</FormLabel>
                  <HStack spacing={0} w="100%">
                    <Button
                      flex={1}
                      bg={gameType === 'LIVE' ? 'brand.500' : 'grey.100'}
                      color={gameType === 'LIVE' ? 'white' : 'grey.700'}
                      border="2px solid"
                      borderColor={gameType === 'LIVE' ? 'brand.500' : 'grey.300'}
                      onClick={() => setGameType('LIVE')}
                      borderRightRadius={0}
                      _hover={{ opacity: 0.9 }}
                    >
                      Live
                    </Button>
                    <Button
                      flex={1}
                      bg={gameType === 'WEEKLY' ? 'purple.500' : 'grey.100'}
                      color={gameType === 'WEEKLY' ? 'white' : 'grey.700'}
                      border="2px solid"
                      borderColor={gameType === 'WEEKLY' ? 'purple.500' : 'grey.300'}
                      onClick={() => setGameType('WEEKLY')}
                      borderLeftRadius={0}
                      _hover={{ opacity: 0.9 }}
                    >
                      Weekly
                    </Button>
                  </HStack>
                </FormControl>

                <Divider borderColor="grey.300" />

                {/* Live Game Fields */}
                {gameType === 'LIVE' && (
                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Scheduled Time (Optional)</FormLabel>
                    <Input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      color="grey.900"
                      borderColor="grey.300"
                      sx={{ '&::-webkit-calendar-picker-indicator': { filter: 'invert(0.5)' } }}
                    />
                  </FormControl>
                )}

                {/* Weekly Game Fields */}
                {gameType === 'WEEKLY' && (
                  <>
                    <FormControl isRequired>
                      <FormLabel color="grey.900" fontWeight="semibold">Result Date</FormLabel>
                      <Input
                        type="datetime-local"
                        value={resultDate}
                        onChange={(e) => setResultDate(e.target.value)}
                        color="grey.900"
                        borderColor="grey.300"
                        sx={{ '&::-webkit-calendar-picker-indicator': { filter: 'invert(0.5)' } }}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel color="grey.900" fontWeight="semibold">Per Day Numbers</FormLabel>
                      <Select
                        value={numbersPerDay}
                        onChange={(e) => setNumbersPerDay(Number(e.target.value))}
                        color="grey.900"
                        borderColor="grey.300"
                      >
                        <option value={10}>10 numbers/day</option>
                        <option value={15}>15 numbers/day (recommended)</option>
                        <option value={18}>18 numbers/day</option>
                        <option value={30}>30 numbers/day</option>
                        <option value={45}>45 numbers/day</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel color="grey.900" fontWeight="semibold">Total Days</FormLabel>
                      <Select
                        value={totalDays}
                        onChange={(e) => setTotalDays(Number(e.target.value))}
                        color="grey.900"
                        borderColor="grey.300"
                      >
                        <option value={3}>3 days</option>
                        <option value={5}>5 days</option>
                        <option value={6}>6 days (recommended)</option>
                        <option value={7}>7 days</option>
                      </Select>
                    </FormControl>

                    <Text fontSize="xs" color="grey.500">
                      {numbersPerDay} numbers/day x {totalDays} days = {numbersPerDay * totalDays} numbers
                      {numbersPerDay * totalDays > 90 && ' (max 90)'}
                    </Text>
                  </>
                )}

                <Divider borderColor="grey.300" />
                <Heading size="sm" color="grey.900">Prize Configuration</Heading>

                <FormControl>
                  <FormLabel color="grey.900" fontWeight="semibold">Early 5</FormLabel>
                  <NumberInput value={early5Prize} onChange={(_, val) => setEarly5Prize(val)}>
                    <NumberInputField color="grey.900" borderColor="grey.300" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel color="grey.900" fontWeight="semibold">Top Line</FormLabel>
                  <NumberInput value={topLinePrize} onChange={(_, val) => setTopLinePrize(val)}>
                    <NumberInputField color="grey.900" borderColor="grey.300" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel color="grey.900" fontWeight="semibold">Middle Line</FormLabel>
                  <NumberInput value={middleLinePrize} onChange={(_, val) => setMiddleLinePrize(val)}>
                    <NumberInputField color="grey.900" borderColor="grey.300" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel color="grey.900" fontWeight="semibold">Bottom Line</FormLabel>
                  <NumberInput value={bottomLinePrize} onChange={(_, val) => setBottomLinePrize(val)}>
                    <NumberInputField color="grey.900" borderColor="grey.300" />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel color="grey.900" fontWeight="semibold">Full House</FormLabel>
                  <NumberInput value={fullHousePrize} onChange={(_, val) => setFullHousePrize(val)}>
                    <NumberInputField color="grey.900" borderColor="grey.300" />
                  </NumberInput>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme={gameType === 'LIVE' ? 'brand' : 'purple'}
                  size="lg"
                  isLoading={isCreating}
                  loadingText="Creating..."
                >
                  {gameType === 'LIVE' ? 'Create Live Game' : 'Create Weekly Game'}
                </Button>
              </VStack>
            </form>
          </Box>

          {/* Weekly Games Management */}
          {weeklyGames.length > 0 && (
            <Box mt={6}>
              <Heading size={{ base: 'sm', md: 'md' }} mb={4} color="white">
                Weekly Games
              </Heading>
              <VStack spacing={3} align="stretch">
                {weeklyGames.map((g) => (
                  <Box key={g.id} p={4} bg="white" borderRadius="lg" border="1px" borderColor="grey.200">
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="bold" color="grey.900" fontFamily="mono">
                        {g.id.slice(0, 8)}
                      </Text>
                      <Badge colorScheme={g.status === 'ACTIVE' ? 'green' : g.status === 'COMPLETED' ? 'blue' : 'gray'}>
                        {g.status}
                      </Badge>
                    </HStack>
                    <HStack spacing={4} mb={3} flexWrap="wrap">
                      <Text fontSize="xs" color="grey.600">
                        Players: {g.playerCount || 0}
                      </Text>
                      <Text fontSize="xs" color="grey.600">
                        Numbers: {g.revealedCount}/90
                      </Text>
                      {g.resultDate && (
                        <Text fontSize="xs" color="grey.600">
                          Result: {new Date(g.resultDate).toLocaleDateString()}
                        </Text>
                      )}
                    </HStack>
                    <HStack spacing={2}>
                      {g.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          colorScheme="blue"
                          isLoading={completingId === g.id}
                          onClick={() => handleCompleteWeekly(g.id)}
                        >
                          Complete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="outline"
                        isLoading={deletingId === g.id}
                        onClick={() => handleDeleteWeekly(g.id)}
                      >
                        Delete
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}
        </Box>
      </VStack>
    </Box>
  );
}
