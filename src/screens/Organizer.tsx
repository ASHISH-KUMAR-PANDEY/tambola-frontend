import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  useToast,
  Divider,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react';
import { apiService } from '../services/api.service';
import { useGameStore } from '../stores/gameStore';
import { Logo } from '../components/Logo';

export default function Organizer() {
  const navigate = useNavigate();
  const toast = useToast();
  const { setCurrentGame } = useGameStore();

  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [scheduledTime, setScheduledTime] = useState('');
  const [early5Prize, setEarly5Prize] = useState(100);
  const [topLinePrize, setTopLinePrize] = useState(200);
  const [middleLinePrize, setMiddleLinePrize] = useState(200);
  const [bottomLinePrize, setBottomLinePrize] = useState(200);
  const [fullHousePrize, setFullHousePrize] = useState(500);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const game = await apiService.createGame({
        scheduledTime: scheduledTime || new Date().toISOString(),
        prizes: {
          early5: early5Prize,
          topLine: topLinePrize,
          middleLine: middleLinePrize,
          bottomLine: bottomLinePrize,
          fullHouse: fullHousePrize,
        },
      });

      toast({
        title: 'Game Created',
        description: 'Returning to lobby...',
        status: 'success',
        duration: 2000,
      });

      setCurrentGame(game);

      // Navigate back to lobby to see the game
      setTimeout(() => {
        navigate('/lobby');
      }, 500);
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
            TAMBOLA - Organizer
          </Heading>
          <Button
            position="absolute"
            top={0}
            right={0}
            variant="outline"
            colorScheme="brand"
            onClick={() => navigate('/lobby')}
            size="sm"
          >
            Back to Lobby
          </Button>
        </Box>

        <Box maxW="600px" w="100%" mx="auto">
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

              <form onSubmit={handleCreateGame}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel color="grey.900" fontWeight="semibold">Scheduled Time (Optional)</FormLabel>
                    <Input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      color="grey.900"
                      borderColor="grey.300"
                    />
                  </FormControl>

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
                    colorScheme="brand"
                    size="lg"
                    isLoading={isCreating}
                    loadingText="Creating..."
                  >
                    Create Game
                  </Button>
                </VStack>
              </form>
            </Box>
          </Box>
    </VStack>
  </Box>
);
}

