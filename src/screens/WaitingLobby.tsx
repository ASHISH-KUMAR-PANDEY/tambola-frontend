import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  GridItem,
  Spinner,
  Center,
  useToast,
  Badge,
} from '@chakra-ui/react';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';
import { Logo } from '../components/Logo';

interface LobbyPlayer {
  userId: string;
  userName: string;
}

export default function WaitingLobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();

  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [isJoining, setIsJoining] = useState(true);

  useEffect(() => {
    if (!gameId || !user) {
      navigate('/lobby');
      return;
    }

    // Check if user is organizer (for future use)
    // You'll need to pass this info from the previous screen or fetch from API
    // For now, we'll determine it from the game join response

    // Connect WebSocket if not already connected
    if (!wsService.isConnected()) {
      wsService.connect(user.id);
    }

    // Join waiting lobby
    const userName = localStorage.getItem('playerName') || user.name || 'Player';
    wsService.joinLobby(gameId, userName);

    // Setup listeners
    wsService.on({
      onLobbyJoined: (data) => {
        console.log('[WaitingLobby] Joined lobby:', data);
        setPlayers(data.players || []);
        setPlayerCount(data.playerCount || 0);
        setIsJoining(false);
      },
      onLobbyPlayerJoined: (data) => {
        console.log('[WaitingLobby] Player joined:', data);
        setPlayers(data.players || []);
        setPlayerCount(data.playerCount || 0);

        toast({
          title: 'खिलाड़ी शामिल हुआ',
          description: `${data.userName} इस गेम में शामिल हुए`,
          status: 'info',
          duration: 2000,
        });
      },
      onLobbyPlayerLeft: (data) => {
        console.log('[WaitingLobby] Player left:', data);
        setPlayers(data.players || []);
        setPlayerCount(data.playerCount || 0);
      },
      onGameStarting: (data) => {
        console.log('[WaitingLobby] Game starting:', data);

        toast({
          title: 'खेल शुरू हो रहा है!',
          description: 'आप खेल में जा रहे हैं...',
          status: 'success',
          duration: 2000,
        });

        // Navigate to game screen after a short delay
        setTimeout(() => {
          navigate(`/game/${data.gameId}`);
        }, 1000);
      },
      onError: (error) => {
        console.error('[WaitingLobby] Error:', error);

        if (error.code === 'GAME_ALREADY_STARTED') {
          toast({
            title: 'खेल शुरू हो गया है',
            description: 'यह खेल पहले ही शुरू हो चुका है',
            status: 'warning',
            duration: 3000,
          });
          navigate('/lobby');
        } else if (error.code === 'GAME_NOT_FOUND') {
          toast({
            title: 'खेल नहीं मिला',
            description: 'यह खेल अब उपलब्ध नहीं है',
            status: 'error',
            duration: 3000,
          });
          navigate('/lobby');
        } else {
          toast({
            title: 'त्रुटि',
            description: error.message || 'कुछ गलत हो गया',
            status: 'error',
            duration: 3000,
          });
        }
      },
    });

    // Cleanup on unmount
    return () => {
      // Leave lobby when component unmounts
      wsService.leaveLobby(gameId);
      wsService.off();
    };
  }, [gameId, user, navigate, toast]);

  const handleLeave = () => {
    wsService.leaveLobby(gameId);
    navigate('/lobby');
  };

  if (isJoining) {
    return (
      <Center h="100vh" bg="grey.900">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" />
          <Text color="white" fontSize="lg">
            लॉबी में शामिल हो रहे हैं...
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="grey.900" pb={20}>
      {/* Header */}
      <Box bg="grey.800" py={4} px={6} borderBottom="1px" borderColor="grey.700">
        <HStack justify="space-between">
          <Logo height="30px" />
          <Button
            size="sm"
            variant="ghost"
            colorScheme="red"
            onClick={handleLeave}
          >
            छोड़ें
          </Button>
        </HStack>
      </Box>

      {/* Content */}
      <VStack spacing={6} py={8} px={4} maxW="container.md" mx="auto">
        {/* Player Count */}
        <Box
          bg="grey.800"
          p={6}
          borderRadius="xl"
          w="100%"
          textAlign="center"
          borderWidth="2px"
          borderColor="brand.400"
        >
          <Text color="grey.400" fontSize="sm" mb={2}>
            खिलाड़ी
          </Text>
          <Heading color="brand.400" size="2xl">
            {playerCount}
          </Heading>
        </Box>

        {/* Waiting Message */}
        <Box
          bg="grey.800"
          p={6}
          borderRadius="xl"
          w="100%"
          textAlign="center"
        >
          <Text color="white" fontSize="lg" fontWeight="bold" mb={2}>
            प्रतीक्षा कक्ष
          </Text>
          <Text color="grey.400" fontSize="md">
            अन्य खिलाड़ी शामिल हो रहे हैं...
          </Text>
        </Box>

        {/* Players List */}
        <Box w="100%">
          <Text color="white" fontSize="lg" fontWeight="bold" mb={4}>
            शामिल खिलाड़ी
          </Text>
          <Grid
            templateColumns="repeat(auto-fill, minmax(150px, 1fr))"
            gap={3}
          >
            {players.map((player, index) => (
              <GridItem key={player.userId}>
                <Box
                  bg="grey.800"
                  p={4}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={
                    player.userId === user?.id ? 'brand.400' : 'grey.700'
                  }
                >
                  <HStack spacing={2}>
                    <Badge
                      colorScheme="brand"
                      fontSize="xs"
                      borderRadius="full"
                      px={2}
                    >
                      {index + 1}
                    </Badge>
                    <Text
                      color="white"
                      fontSize="sm"
                      fontWeight="medium"
                      noOfLines={1}
                    >
                      {player.userName}
                    </Text>
                  </HStack>
                  {player.userId === user?.id && (
                    <Text color="brand.400" fontSize="xs" mt={1}>
                      आप
                    </Text>
                  )}
                </Box>
              </GridItem>
            ))}
          </Grid>
        </Box>
      </VStack>

      {/* Bottom Toast - Persistent */}
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="brand.500"
        py={4}
        px={6}
        textAlign="center"
        boxShadow="lg"
      >
        <Text color="white" fontWeight="bold" fontSize="md">
          खेल जल्द शुरू होगा
        </Text>
      </Box>
    </Box>
  );
}
