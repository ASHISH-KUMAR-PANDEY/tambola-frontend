import { useNavigate } from 'react-router-dom';
import { Box, Container, Heading, Text, VStack, Button, HStack, Stack } from '@chakra-ui/react';
import { Logo } from '../components/Logo';

const Home = () => {
  const navigate = useNavigate();

  return (
    <Container maxW="container.xl" py={{ base: 8, md: 12, lg: 20 }} px={{ base: 4, md: 8 }}>
      <VStack spacing={{ base: 6, md: 8, lg: 12 }} align="center">
        <Box textAlign="center">
          <Box display="flex" justifyContent="center" mb={{ base: 4, md: 6 }}>
            <Logo height={{ base: '32px', md: '36px', lg: '40px' }} />
          </Box>
          <Heading size={{ base: 'xl', md: '2xl', lg: '3xl' }} mb={{ base: 2, md: 4 }} color="white">
            TAMBOLA
          </Heading>
          <Text fontSize={{ base: 'md', md: 'lg', lg: 'xl' }} color="grey.400" mb={{ base: 4, md: 6, lg: 8 }}>
            Real-time multiplayer Tambola (Bingo) game platform
          </Text>
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={4} justify="center">
            <Button
              colorScheme="brand"
              size={{ base: 'md', md: 'lg' }}
              onClick={() => navigate('/login')}
              w={{ base: 'full', sm: 'auto' }}
            >
              Login
            </Button>
            <Button
              variant="outline"
              colorScheme="brand"
              size={{ base: 'md', md: 'lg' }}
              onClick={() => navigate('/signup')}
              w={{ base: 'full', sm: 'auto' }}
            >
              Sign Up
            </Button>
          </Stack>
        </Box>

        <Box
          maxW="2xl"
          p={{ base: 4, md: 6, lg: 8 }}
          borderWidth="1px"
          borderRadius="lg"
          bg="grey.700"
          borderColor="grey.600"
          shadow="lg"
        >
          <Heading size={{ base: 'md', md: 'lg' }} mb={{ base: 4, md: 6 }} textAlign="center" color="white">
            How to Play
          </Heading>

          <VStack align="start" spacing={{ base: 3, md: 4 }}>
            <Box>
              <Heading size={{ base: 'xs', md: 'sm' }} mb={2} color="white">
                1. Join a Game
              </Heading>
              <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }}>
                Browse available games in the lobby and join one. You'll receive a unique 3x9 Tambola ticket.
              </Text>
            </Box>

            <Box>
              <Heading size={{ base: 'xs', md: 'sm' }} mb={2} color="white">
                2. Mark Your Numbers
              </Heading>
              <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }}>
                As numbers are called, click them to mark on your ticket. Watch for winning patterns!
              </Text>
            </Box>

            <Box>
              <Heading size={{ base: 'xs', md: 'sm' }} mb={2} color="white">
                3. Win Prizes
              </Heading>
              <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }}>
                Complete patterns like Early 5, Lines, or Full House to win prizes. Multiple winners compete for categories!
              </Text>
            </Box>

            <Box>
              <Heading size={{ base: 'xs', md: 'sm' }} mb={2} color="white">
                4. Organize Games
              </Heading>
              <Text color="grey.400" fontSize={{ base: 'sm', md: 'md' }}>
                Create your own games, set prize values, and manage the game flow from the Organizer Panel.
              </Text>
            </Box>
          </VStack>
        </Box>

        <Box textAlign="center" px={{ base: 4, md: 0 }}>
          <Text fontSize={{ base: 'xs', md: 'sm' }} color="grey.500">
            Built with React, Fastify, Socket.IO, MongoDB, and Redis
          </Text>
        </Box>
      </VStack>
    </Container>
  );
};

export default Home;
