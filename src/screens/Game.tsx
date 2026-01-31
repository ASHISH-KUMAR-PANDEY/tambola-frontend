import { useEffect, useState } from 'react';
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
} from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { Ticket } from '../components/Ticket';
import { Logo } from '../components/Logo';
import { GameSummaryModal } from '../components/GameSummaryModal';
import { useTambolaTracking } from '../hooks/useTambolaTracking';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();
  const { trackEvent } = useTambolaTracking();
  const [showSummary, setShowSummary] = useState(false);
  const [gameStartTime] = useState<number>(Date.now());

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

  useEffect(() => {
    if (!gameId) {
      navigate('/lobby', { replace: true });
      return;
    }

    // Always join/rejoin the game room when component mounts
    // Backend will return existing ticket if already joined
    wsService.joinGame(gameId);

    // Setup WebSocket event handlers
    wsService.on({
      onStateSync: (data) => {
        // Sync game state when rejoining
        syncGameState(
          data.calledNumbers,
          data.currentNumber || null,
          data.players,
          data.winners as any
        );
      },
      onPlayerJoined: (data) => {
        addPlayer({ playerId: data.playerId, userName: data.userName });
        toast({
          title: 'खिलाड़ी शामिल हुए',
          description: `${data.userName} गेम में शामिल हुए`,
          status: 'info',
          duration: 3000,
        });
      },
      onGameStarted: () => {
        toast({
          title: 'गेम शुरू हो गया!',
          description: 'अपने नंबर मार्क करने के लिए तैयार हो जाएं',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      },
      onNumberCalled: (data) => {
        addCalledNumber(data.number);
      },
      onWinner: (data) => {
        const categoryName = data.category
          .split('_')
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' ');

        addWinner(data);

        const userName = (data as any).userName || 'कोई';
        toast({
          title: `विजेता: ${categoryName}!`,
          description: `${userName} ने ${categoryName} जीता!`,
          status: 'success',
          duration: 10000,
          isClosable: true,
        });
      },
      onWinClaimed: (data) => {
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

    return () => {
      if (gameId) {
        wsService.leaveGame(gameId);
      }
      wsService.off();
    };
  }, [gameId]);

  const handleLeaveGame = () => {
    if (gameId) {
      wsService.leaveGame(gameId);
    }
    clearGame();
    navigate('/lobby');
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    clearGame();
    navigate('/lobby');
  };

  const handleClaimWin = (category: string) => {
    if (!gameId) return;
    wsService.claimWin(gameId, category);
  };

  const handleNumberClick = (number: number) => {
    // Number successfully marked in frontend state, now sync to backend
    if (gameId && playerId) {
      wsService.markNumber(gameId, playerId, number);
    }
  };

  const getCategoryWinner = (category: string) => {
    return winners.find((w) => w.category === category);
  };

  const renderNumberBoard = () => {
    const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
    return (
      <Grid templateColumns={{ base: 'repeat(10, minmax(0, 1fr))', md: 'repeat(10, 1fr)' }} gap={{ base: 1, sm: 1.5, md: 2 }}>
        {numbers.map((num) => {
          const isCalled = calledNumbers.includes(num);
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
              { key: 'EARLY_5', label: 'अर्ली 5' },
              { key: 'TOP_LINE', label: 'टॉप लाइन', lineIndex: 0 },
              { key: 'MIDDLE_LINE', label: 'मिडिल लाइन', lineIndex: 1 },
              { key: 'BOTTOM_LINE', label: 'बॉटम लाइन', lineIndex: 2 },
              { key: 'FULL_HOUSE', label: 'फुल हाउस' },
            ].map(({ key, label, lineIndex }) => {
              const winner = getCategoryWinner(key);
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
                    <Badge colorScheme="green" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>जीत लिया ✓</Badge>
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
                    {winner.category.split('_').join(' ')}
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
