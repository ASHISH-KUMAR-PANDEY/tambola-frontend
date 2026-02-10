import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  VStack,
} from '@chakra-ui/react';
import { apiService, type PromotionalBanner, type YouTubeEmbed, type YouTubeLiveStream, type RegistrationCard } from '../services/api.service';
import { Logo } from '../components/Logo';
import { PromotionalBannerUpload } from '../components/PromotionalBannerUpload';
import { YouTubeEmbedManagement } from '../components/YouTubeEmbedManagement';
import { YouTubeLiveStreamManagement } from '../components/YouTubeLiveStreamManagement';
import { RegistrationCardManagement } from '../components/RegistrationCardManagement';

export default function BannerManagement() {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState<PromotionalBanner | null>(null);
  const [currentEmbed, setCurrentEmbed] = useState<YouTubeEmbed | null>(null);
  const [currentLiveStream, setCurrentLiveStream] = useState<YouTubeLiveStream | null>(null);
  const [currentRegistrationCard, setCurrentRegistrationCard] = useState<RegistrationCard | null>(null);

  useEffect(() => {
    loadCurrentBanner();
    loadCurrentEmbed();
    loadCurrentLiveStream();
    loadActiveRegistrationCard();
  }, []);

  const loadCurrentBanner = async () => {
    try {
      const banner = await apiService.getCurrentPromotionalBanner();
      setCurrentBanner(banner);
    } catch (error) {
      console.error('Failed to load promotional banner:', error);
    }
  };

  const loadCurrentEmbed = async () => {
    try {
      const embed = await apiService.getCurrentYouTubeEmbed();
      setCurrentEmbed(embed);
    } catch (error) {
      console.error('Failed to load YouTube embed:', error);
    }
  };

  const loadCurrentLiveStream = async () => {
    try {
      const stream = await apiService.getCurrentYouTubeLiveStream();
      setCurrentLiveStream(stream);
    } catch (error) {
      console.error('Failed to load YouTube live stream:', error);
    }
  };

  const loadActiveRegistrationCard = async () => {
    try {
      const card = await apiService.getActiveRegistrationCard();
      setCurrentRegistrationCard(card);
    } catch (error) {
      console.error('Failed to load registration card:', error);
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

        <VStack spacing={6} maxW="800px" w="100%" mx="auto">
          <RegistrationCardManagement
            currentCard={currentRegistrationCard}
            onCreateSuccess={(card) => setCurrentRegistrationCard(card)}
            onDeleteSuccess={() => setCurrentRegistrationCard(null)}
          />

          <PromotionalBannerUpload
            currentBanner={currentBanner}
            onUploadSuccess={(banner) => setCurrentBanner(banner)}
            onDeleteSuccess={() => setCurrentBanner(null)}
          />

          <YouTubeEmbedManagement
            currentEmbed={currentEmbed}
            onSetSuccess={(embed) => setCurrentEmbed(embed)}
            onDeleteSuccess={() => setCurrentEmbed(null)}
          />

          <YouTubeLiveStreamManagement
            currentStream={currentLiveStream}
            onSetSuccess={(stream) => setCurrentLiveStream(stream)}
            onDeleteSuccess={() => setCurrentLiveStream(null)}
          />
        </VStack>
      </VStack>
    </Box>
  );
}
