import { useState, useRef } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  Image,
  useToast,
  HStack,
  Icon,
  Spinner,
} from '@chakra-ui/react';
import { DeleteIcon, AttachmentIcon } from '@chakra-ui/icons';
import { apiService, type PromotionalBanner } from '../services/api.service';

interface Props {
  currentBanner: PromotionalBanner | null;
  onUploadSuccess: (banner: PromotionalBanner) => void;
  onDeleteSuccess: () => void;
}

export function PromotionalBannerUpload({
  currentBanner,
  onUploadSuccess,
  onDeleteSuccess,
}: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validateImage = async (file: File): Promise<boolean> => {
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Image must be less than 5MB',
        status: 'error',
        duration: 5000,
      });
      return false;
    }

    // Check aspect ratio (16:9)
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const targetRatio = 16 / 9;
        const tolerance = 0.01;

        if (Math.abs(aspectRatio - targetRatio) > tolerance) {
          toast({
            title: 'Invalid Aspect Ratio',
            description: `Image must be 16:9 aspect ratio. Current: ${aspectRatio.toFixed(2)}:1`,
            status: 'error',
            duration: 5000,
          });
          resolve(false);
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        toast({
          title: 'Invalid Image',
          description: 'Could not load image file',
          status: 'error',
          duration: 5000,
        });
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (file: File) => {
    const isValid = await validateImage(file);
    if (!isValid) return;

    setIsUploading(true);
    try {
      const banner = await apiService.uploadPromotionalBanner(file);
      toast({
        title: 'Banner Uploaded',
        description: 'Promotional banner uploaded successfully',
        status: 'success',
        duration: 3000,
      });
      onUploadSuccess(banner);
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload promotional banner',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiService.deletePromotionalBanner();
      toast({
        title: 'Banner Deleted',
        description: 'Promotional banner deleted successfully',
        status: 'success',
        duration: 3000,
      });
      onDeleteSuccess();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete promotional banner',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
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
        Promotional Banner
      </Text>

      {currentBanner ? (
        <VStack align="stretch" spacing={4}>
          <Box
            borderRadius="md"
            overflow="hidden"
            border="2px"
            borderColor="grey.300"
          >
            <Image
              src={currentBanner.imageUrl}
              alt="Current promotional banner"
              w="100%"
              objectFit="cover"
              aspectRatio={16 / 9}
            />
          </Box>
          <Text fontSize="sm" color="grey.600">
            {currentBanner.width} × {currentBanner.height} pixels
          </Text>
          <HStack spacing={3}>
            <Button
              colorScheme="brand"
              size={{ base: 'sm', md: 'md' }}
              leftIcon={<AttachmentIcon />}
              onClick={() => fileInputRef.current?.click()}
              isLoading={isUploading}
              flex={1}
            >
              Replace Image
            </Button>
            <Button
              colorScheme="red"
              variant="outline"
              size={{ base: 'sm', md: 'md' }}
              leftIcon={<DeleteIcon />}
              onClick={handleDelete}
              isLoading={isDeleting}
              flex={1}
            >
              Remove
            </Button>
          </HStack>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </VStack>
      ) : (
        <VStack align="stretch" spacing={4}>
          <Box
            border="2px dashed"
            borderColor={dragActive ? 'brand.500' : 'grey.300'}
            borderRadius="md"
            p={8}
            textAlign="center"
            bg={dragActive ? 'brand.50' : 'grey.50'}
            cursor="pointer"
            transition="all 0.2s"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <VStack spacing={3}>
                <Spinner size="xl" color="brand.500" />
                <Text color="grey.600">Uploading...</Text>
              </VStack>
            ) : (
              <VStack spacing={3}>
                <Icon as={AttachmentIcon} w={12} h={12} color="grey.400" />
                <Text fontWeight="bold" color="grey.700">
                  Drop image here or click to upload
                </Text>
                <Text fontSize="sm" color="grey.500">
                  Aspect ratio: 16:9 | Max size: 5MB
                </Text>
                <Text fontSize="xs" color="grey.400">
                  Recommended: 1920×1080, 1280×720, or 3840×2160
                </Text>
              </VStack>
            )}
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </VStack>
      )}
    </Box>
  );
}
