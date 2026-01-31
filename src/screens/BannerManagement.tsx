import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  VStack,
} from '@chakra-ui/react';
import { apiService, type PromotionalBanner } from '../services/api.service';
import { Logo } from '../components/Logo';
import { PromotionalBannerUpload } from '../components/PromotionalBannerUpload';

export default function BannerManagement() {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState<PromotionalBanner | null>(null);

  useEffect(() => {
    loadCurrentBanner();
  }, []);

  const loadCurrentBanner = async () => {
    try {
      const banner = await apiService.getCurrentPromotionalBanner();
      setCurrentBanner(banner);
    } catch (error) {
      console.error('Failed to load promotional banner:', error);
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
            Banner Management
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

        <Box maxW="800px" w="100%" mx="auto">
          <PromotionalBannerUpload
            currentBanner={currentBanner}
            onUploadSuccess={(banner) => setCurrentBanner(banner)}
            onDeleteSuccess={() => setCurrentBanner(null)}
          />
        </Box>
      </VStack>
    </Box>
  );
}
