import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Center,
  Grid,
  GridItem,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { apiService, type WeeklyGame } from '../services/api.service';
import { Logo } from '../components/Logo';

export default function Individual() {
  const navigate = useNavigate();
  const toast = useToast();
  const [games, setGames] = useState<WeeklyGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGames = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getWeeklyGames();
      setGames(data);
    } catch (error) {
      console.error('Failed to load weekly games:', error);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  if (isLoading) {
    return (
      <Center h="100vh" w="100vw">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bg="grey.900">
      <VStack spacing={{ base: 4, md: 6 }} w="100%" align="stretch" p={{ base: 3, md: 4 }}>
        {/* Header */}
        <VStack spacing={2} w="100%">
          <HStack w="100%" justify="space-between" align="center">
            <Logo height="28px" />
            <HStack gap={2}>
              <Button
                variant="outline"
                colorScheme="green"
                size={{ base: 'xs', md: 'sm' }}
                onClick={loadGames}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                colorScheme="brand"
                size={{ base: 'xs', md: 'sm' }}
                onClick={() => navigate('/lobby')}
              >
                वापस
              </Button>
            </HStack>
          </HStack>
          <Heading size={{ base: 'md', md: 'xl' }} color="white" textAlign="center">
            INDIVIDUAL TAMBOLA
          </Heading>
        </VStack>

        {/* Info */}
        <Box bg="brand.900" borderRadius="lg" p={4} border="1px solid" borderColor="brand.700">
          <Text color="brand.200" fontSize="sm" textAlign="center">
            अपनी सुविधा अनुसार खेलें! हर कुछ घंटों में नया नंबर आएगा। रविवार को सबका रिज़ल्ट एक साथ आएगा।
          </Text>
        </Box>

        {/* Games List */}
        {games.length === 0 ? (
          <Box
            p={8}
            bg="grey.800"
            borderRadius="lg"
            textAlign="center"
          >
            <Text color="grey.500" fontSize="md">
              फिलहाल कोई साप्ताहिक गेम उपलब्ध नहीं है
            </Text>
          </Box>
        ) : (
          <Grid
            templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
            gap={4}
          >
            {games.map((game) => {
              const resultDate = game.resultDate ? new Date(game.resultDate) : null;
              const daysLeft = resultDate
                ? Math.max(0, Math.ceil((resultDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
              const isCompleted = game.status === 'COMPLETED';

              return (
                <GridItem key={game.id}>
                  <Box
                    p={5}
                    bg="grey.800"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor={isCompleted ? 'grey.600' : 'purple.500'}
                    _hover={{ borderColor: 'purple.400', transform: 'translateY(-2px)' }}
                    transition="all 0.2s"
                  >
                    <HStack justify="space-between" mb={3}>
                      <Badge colorScheme="purple" fontSize="xs">WEEKLY</Badge>
                      <Badge colorScheme={isCompleted ? 'gray' : 'green'} fontSize="xs">
                        {isCompleted ? 'पूर्ण' : 'चल रहा है'}
                      </Badge>
                    </HStack>

                    <VStack align="start" spacing={2}>
                      <HStack>
                        <Text color="white" fontSize="2xl" fontWeight="bold">
                          {game.revealedCount}
                        </Text>
                        <Text color="grey.400" fontSize="sm">/90 नंबर आए</Text>
                      </HStack>

                      <Text color="grey.400" fontSize="sm">
                        {game.playerCount} खिलाड़ी
                      </Text>

                      {game.revealIntervalMin && (
                        <Text color="grey.500" fontSize="xs">
                          हर {game.revealIntervalMin >= 60
                            ? `${Math.round(game.revealIntervalMin / 60)} घंटे`
                            : `${game.revealIntervalMin} मिनट`} में नया नंबर
                        </Text>
                      )}

                      {resultDate && (
                        <Text color={isCompleted ? 'green.300' : 'orange.300'} fontSize="xs">
                          {isCompleted
                            ? 'परिणाम उपलब्ध'
                            : daysLeft !== null && daysLeft > 0
                            ? `${daysLeft} दिन बाकी`
                            : 'आज रिज़ल्ट आएगा'}
                        </Text>
                      )}
                    </VStack>

                    <Button
                      mt={4}
                      size="sm"
                      colorScheme={isCompleted ? 'gray' : 'purple'}
                      w="100%"
                      onClick={() => navigate(`/individual/${game.id}`)}
                    >
                      {isCompleted ? 'परिणाम देखें' : 'खेलें'}
                    </Button>
                  </Box>
                </GridItem>
              );
            })}
          </Grid>
        )}
      </VStack>
    </Box>
  );
}
