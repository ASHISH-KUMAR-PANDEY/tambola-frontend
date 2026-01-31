import { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  useToast,
  HStack,
  Input,
  FormControl,
  FormLabel,
  AspectRatio,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { apiService, type YouTubeEmbed } from '../services/api.service';

interface Props {
  currentEmbed: YouTubeEmbed | null;
  onSetSuccess: (embed: YouTubeEmbed) => void;
  onDeleteSuccess: () => void;
}

export function YouTubeEmbedManagement({
  currentEmbed,
  onSetSuccess,
  onDeleteSuccess,
}: Props) {
  const toast = useToast();
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!videoUrl.trim()) {
      toast({
        title: 'URL Required',
        description: 'Please enter a YouTube video URL',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const embed = await apiService.setYouTubeEmbed(videoUrl);
      toast({
        title: 'Video Set',
        description: 'YouTube video has been set successfully',
        status: 'success',
        duration: 3000,
      });
      onSetSuccess(embed);
      setVideoUrl('');
    } catch (error: any) {
      toast({
        title: 'Failed to Set Video',
        description: error.message || 'Invalid YouTube URL or server error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiService.deleteYouTubeEmbed();
      toast({
        title: 'Video Removed',
        description: 'YouTube video has been removed successfully',
        status: 'success',
        duration: 3000,
      });
      onDeleteSuccess();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete YouTube video',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box
      p={{ base: 4, md: 6 }}
      bg="white"
      borderRadius="lg"
      boxShadow="md"
      w="100%"
    >
      <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="bold" mb={4} color="grey.900">
        YouTube Video
      </Text>

      {currentEmbed ? (
        <VStack align="stretch" spacing={4}>
          <AspectRatio ratio={16 / 9}>
            <iframe
              src={`https://www.youtube.com/embed/${currentEmbed.embedId}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                border: '2px solid #E2E8F0',
                borderRadius: '8px',
              }}
            />
          </AspectRatio>
          <Text fontSize="sm" color="grey.600">
            Video URL: {currentEmbed.videoUrl}
          </Text>
          <HStack spacing={3}>
            <Button
              colorScheme="red"
              variant="outline"
              size={{ base: 'sm', md: 'md' }}
              leftIcon={<DeleteIcon />}
              onClick={handleDelete}
              isLoading={isDeleting}
              flex={1}
            >
              Remove Video
            </Button>
          </HStack>
        </VStack>
      ) : (
        <form onSubmit={handleSubmit}>
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel color="grey.900" fontWeight="semibold">
                YouTube Video URL
              </FormLabel>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                color="grey.900"
                borderColor="grey.300"
              />
              <Text fontSize="xs" color="grey.500" mt={2}>
                Paste any YouTube video URL (e.g., youtube.com/watch?v=... or youtu.be/...)
              </Text>
            </FormControl>
            <Button
              type="submit"
              colorScheme="brand"
              size={{ base: 'sm', md: 'md' }}
              isLoading={isSubmitting}
              loadingText="Setting..."
            >
              Set Video
            </Button>
          </VStack>
        </form>
      )}
    </Box>
  );
}
