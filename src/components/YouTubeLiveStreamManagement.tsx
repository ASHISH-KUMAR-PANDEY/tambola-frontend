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
import { apiService, type YouTubeLiveStream } from '../services/api.service';

interface Props {
  currentStream: YouTubeLiveStream | null;
  onSetSuccess: (stream: YouTubeLiveStream) => void;
  onDeleteSuccess: () => void;
}

export function YouTubeLiveStreamManagement({
  currentStream,
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
        description: 'Please enter a YouTube live stream URL',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const stream = await apiService.setYouTubeLiveStream(videoUrl);
      toast({
        title: 'Live Stream Set',
        description: 'YouTube live stream has been set successfully',
        status: 'success',
        duration: 3000,
      });
      onSetSuccess(stream);
      setVideoUrl('');
    } catch (error: any) {
      toast({
        title: 'Failed to Set Live Stream',
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
      await apiService.deleteYouTubeLiveStream();
      toast({
        title: 'Live Stream Removed',
        description: 'YouTube live stream has been removed successfully',
        status: 'success',
        duration: 3000,
      });
      onDeleteSuccess();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete YouTube live stream',
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
        YouTube Live Stream (Game Screen)
      </Text>

      {currentStream ? (
        <VStack align="stretch" spacing={4}>
          <AspectRatio ratio={16 / 9}>
            <iframe
              src={`https://www.youtube.com/embed/${currentStream.embedId}?autoplay=0&mute=0`}
              title="YouTube live stream preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                border: '2px solid #E2E8F0',
                borderRadius: '8px',
              }}
            />
          </AspectRatio>
          <Text fontSize="sm" color="grey.600">
            Stream URL: {currentStream.videoUrl}
          </Text>
          <Text fontSize="xs" color="orange.600" fontWeight="semibold">
            Note: Live stream will autoplay with sound on the player's game screen
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
              Remove Live Stream
            </Button>
          </HStack>
        </VStack>
      ) : (
        <form onSubmit={handleSubmit}>
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel color="grey.900" fontWeight="semibold">
                YouTube Live Stream URL
              </FormLabel>
              <Input
                placeholder="https://www.youtube.com/watch?v=... or https://www.youtube.com/live/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                color="grey.900"
                borderColor="grey.300"
              />
              <Text fontSize="xs" color="grey.500" mt={2}>
                Paste any YouTube video or live stream URL. This will be displayed on the game playing screen with autoplay and sound enabled.
              </Text>
            </FormControl>
            <Button
              type="submit"
              colorScheme="brand"
              size={{ base: 'sm', md: 'md' }}
              isLoading={isSubmitting}
              loadingText="Setting..."
            >
              Set Live Stream
            </Button>
          </VStack>
        </form>
      )}
    </Box>
  );
}
