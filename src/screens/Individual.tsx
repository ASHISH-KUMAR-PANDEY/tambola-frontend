import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Center, Spinner, Text, VStack, Button } from '@chakra-ui/react';
import { apiService } from '../services/api.service';

export default function Individual() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirect = async () => {
      try {
        const games = await apiService.getWeeklyGames();
        const activeGame = games.find((g) => g.status === 'ACTIVE');
        if (activeGame) {
          navigate(`/individual/${activeGame.id}`, { replace: true });
        } else {
          setError('फिलहाल कोई साप्ताहिक गेम उपलब्ध नहीं है');
        }
      } catch {
        setError('गेम लोड नहीं हो सका');
      }
    };
    redirect();
  }, [navigate]);

  if (error) {
    return (
      <Center h="100vh" w="100vw" bg="grey.900">
        <VStack spacing={4}>
          <Text color="grey.400" fontSize="md">{error}</Text>
          <Button variant="outline" colorScheme="brand" onClick={() => navigate('/lobby')}>
            वापस जाएं
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Center h="100vh" w="100vw">
      <Spinner size="xl" color="brand.500" thickness="4px" />
    </Center>
  );
}
