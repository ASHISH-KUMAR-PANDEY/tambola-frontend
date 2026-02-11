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
      <Box bg="grey.800" py={{ base: 3, md: 4 }} px={{ base: 4, md: 6 }} borderBottom="1px" borderColor="grey.700">
        <HStack justify="space-between" align="center">
          <Logo height={{ base: '25px', md: '30px' }} />
          <Button
            size={{ base: 'xs', md: 'sm' }}
            colorScheme="red"
            onClick={handleLeave}
          >
            छोड़ें
          </Button>
        </HStack>
      </Box>

      {/* Content */}
      <VStack spacing={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }} px={{ base: 4, md: 6 }} maxW="container.xl" mx="auto">

        {/* Title with Player Count - Compact */}
        <VStack spacing={{ base: 2, md: 3 }} w="100%">
          <Heading
            size={{ base: 'md', md: 'lg' }}
            color="white"
            textAlign="center"
          >
            प्रतीक्षा कक्ष
          </Heading>
          <HStack spacing={2}>
            <Text color="grey.400" fontSize={{ base: 'xs', md: 'sm' }}>
              कुल खिलाड़ी:
            </Text>
            <Text color="brand.400" fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold">
              {playerCount}
            </Text>
          </HStack>
          <Text color="grey.500" fontSize={{ base: '2xs', md: 'xs' }} textAlign="center">
            अन्य खिलाड़ी शामिल हो रहे हैं...
          </Text>
        </VStack>

        {/* Players Grid */}
        <Box w="100%">
          <Heading
            size={{ base: 'xs', md: 'sm' }}
            mb={{ base: 2, md: 3 }}
            color="white"
          >
            शामिल खिलाड़ी
          </Heading>
          <Grid
            templateColumns={{
              base: 'repeat(3, 1fr)',
              sm: 'repeat(4, 1fr)',
              md: 'repeat(5, 1fr)',
              lg: 'repeat(6, 1fr)',
              xl: 'repeat(8, 1fr)',
            }}
            gap={{ base: 2, md: 3 }}
          >
            {players.map((player) => (
              <GridItem key={player.userId}>
                <Box
                  bg={player.userId === user?.id ? 'grey.600' : 'grey.700'}
                  p={{ base: 2, md: 3 }}
                  borderRadius="md"
                  boxShadow="md"
                  border="2px"
                  borderColor={
                    player.userId === user?.id ? 'brand.500' : 'grey.600'
                  }
                  transition="all 0.2s"
                  _hover={{
                    boxShadow: 'lg',
                    transform: 'translateY(-2px)',
                    borderColor: 'brand.500'
                  }}
                >
                  <Text
                    color="white"
                    fontSize={{ base: 'xs', md: 'sm' }}
                    fontWeight={player.userId === user?.id ? 'bold' : 'medium'}
                    noOfLines={1}
                    textAlign="center"
                  >
                    {player.userName}
                  </Text>
                </Box>
              </GridItem>
            ))}
          </Grid>
        </Box>
      </VStack>

      {/* Bottom Status Bar */}
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="brand.500"
        py={{ base: 3, md: 4 }}
        px={{ base: 4, md: 6 }}
        textAlign="center"
        boxShadow="0 -2px 10px rgba(0, 0, 0, 0.3)"
      >
        <Text
          color="white"
          fontWeight="bold"
          fontSize={{ base: 'xs', md: 'sm' }}
        >
          खेल जल्द शुरू होगा
        </Text>
      </Box>
    </Box>
  );
}
