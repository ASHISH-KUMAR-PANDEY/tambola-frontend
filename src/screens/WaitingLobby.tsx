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
    <Box minH="100vh" bg="grey.900" pb={24}>
      {/* Header */}
      <Box bg="grey.800" py={4} px={{ base: 4, md: 6 }} borderBottom="1px" borderColor="grey.700">
        <HStack justify="space-between">
          <Logo height="30px" />
          <Button
            size={{ base: 'xs', md: 'sm' }}
            variant="outline"
            colorScheme="red"
            onClick={handleLeave}
          >
            छोड़ें
          </Button>
        </HStack>
      </Box>

      {/* Content */}
      <VStack spacing={{ base: 6, md: 8 }} py={{ base: 6, md: 10 }} px={{ base: 4, md: 6 }} maxW="container.lg" mx="auto">

        {/* Title with Player Count */}
        <VStack spacing={2} w="100%">
          <Heading
            size={{ base: 'lg', md: 'xl' }}
            color="white"
            textAlign="center"
          >
            प्रतीक्षा कक्ष
          </Heading>
          <HStack spacing={2}>
            <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }}>
              कुल खिलाड़ी:
            </Text>
            <Badge
              colorScheme="brand"
              fontSize={{ base: 'md', md: 'lg' }}
              px={3}
              py={1}
              borderRadius="full"
            >
              {playerCount}
            </Badge>
          </HStack>
          <Text color="grey.500" fontSize={{ base: 'xs', md: 'sm' }} textAlign="center">
            अन्य खिलाड़ी शामिल हो रहे हैं...
          </Text>
        </VStack>

        {/* Players Grid */}
        <Box w="100%">
          <Heading
            size={{ base: 'sm', md: 'md' }}
            mb={{ base: 3, md: 4 }}
            color="white"
          >
            शामिल खिलाड़ी
          </Heading>
          <Grid
            templateColumns={{
              base: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
            }}
            gap={{ base: 3, md: 4 }}
          >
            {players.map((player, index) => (
              <GridItem key={player.userId}>
                <Box
                  bg="grey.700"
                  p={{ base: 3, md: 4 }}
                  borderRadius="lg"
                  boxShadow="md"
                  border="1px"
                  borderColor={
                    player.userId === user?.id ? 'brand.500' : 'grey.600'
                  }
                  transition="all 0.2s"
                  _hover={{
                    boxShadow: 'lg',
                    transform: 'translateY(-2px)',
                    borderColor: player.userId === user?.id ? 'brand.400' : 'brand.500'
                  }}
                  position="relative"
                >
                  <VStack align="start" spacing={2}>
                    <HStack spacing={2} w="100%">
                      <Badge
                        colorScheme="brand"
                        fontSize="xs"
                        borderRadius="full"
                        px={2}
                      >
                        {index + 1}
                      </Badge>
                      {player.userId === user?.id && (
                        <Badge
                          colorScheme="green"
                          fontSize="xs"
                          borderRadius="full"
                          px={2}
                        >
                          आप
                        </Badge>
                      )}
                    </HStack>
                    <Text
                      color="white"
                      fontSize={{ base: 'sm', md: 'md' }}
                      fontWeight="medium"
                      noOfLines={1}
                      w="100%"
                    >
                      {player.userName}
                    </Text>
                  </VStack>
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
          fontSize={{ base: 'sm', md: 'md' }}
        >
          खेल जल्द शुरू होगा
        </Text>
      </Box>
    </Box>
  );
}
