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
  Textarea,
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { apiService, type RegistrationCard } from '../services/api.service';

interface Props {
  currentCard: RegistrationCard | null;
  onCreateSuccess: (card: RegistrationCard) => void;
  onDeleteSuccess: () => void;
}

export function RegistrationCardManagement({
  currentCard,
  onCreateSuccess,
  onDeleteSuccess,
}: Props) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast({
        title: 'Message Required',
        description: 'Please enter a message',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!targetDate || !targetTime) {
      toast({
        title: 'Date and Time Required',
        description: 'Please select both date and time',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Combine date and time into ISO string
    const targetDateTime = new Date(`${targetDate}T${targetTime}`).toISOString();

    setIsSubmitting(true);
    try {
      if (isEditing && currentCard) {
        // Update existing card
        const card = await apiService.updateRegistrationCard(currentCard.id, {
          message: message.trim(),
          targetDateTime,
        });
        toast({
          title: 'Card Updated',
          description: 'Registration card has been updated successfully',
          status: 'success',
          duration: 3000,
        });
        onCreateSuccess(card);
        setIsEditing(false);
      } else {
        // Create new card
        const card = await apiService.createRegistrationCard(message.trim(), targetDateTime);
        toast({
          title: 'Card Created',
          description: 'Registration card has been created successfully',
          status: 'success',
          duration: 3000,
        });
        onCreateSuccess(card);
      }
      setMessage('');
      setTargetDate('');
      setTargetTime('');
    } catch (error: any) {
      toast({
        title: isEditing ? 'Update Failed' : 'Create Failed',
        description: error.message || 'Failed to save registration card',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    if (currentCard) {
      setMessage(currentCard.message);
      const date = new Date(currentCard.targetDateTime);
      setTargetDate(date.toISOString().split('T')[0]);
      setTargetTime(date.toTimeString().slice(0, 5));
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setMessage('');
    setTargetDate('');
    setTargetTime('');
  };

  const handleDelete = async () => {
    if (!currentCard) return;

    setIsDeleting(true);
    try {
      await apiService.deleteRegistrationCard(currentCard.id);
      toast({
        title: 'Card Removed',
        description: 'Registration card has been removed successfully',
        status: 'success',
        duration: 3000,
      });
      onDeleteSuccess();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete registration card',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetReminders = async () => {
    if (!currentCard) return;

    setIsResetting(true);
    try {
      const updatedCard = await apiService.resetAllReminders(currentCard.id);
      toast({
        title: 'Reminders Reset',
        description: 'All user reminders have been reset. Users will need to register again.',
        status: 'success',
        duration: 5000,
      });
      onCreateSuccess(updatedCard);
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset reminders',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsResetting(false);
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
        Registration Card
      </Text>

      {currentCard && !isEditing ? (
        <VStack align="stretch" spacing={4}>
          <Box
            p={4}
            borderRadius="md"
            border="2px"
            borderColor="brand.500"
            bg="grey.50"
          >
            <Text fontSize="md" fontWeight="semibold" color="grey.900" mb={2}>
              Message:
            </Text>
            <Text fontSize="sm" color="grey.700" mb={3}>
              {currentCard.message}
            </Text>
            <Text fontSize="md" fontWeight="semibold" color="grey.900" mb={2}>
              Target Date & Time:
            </Text>
            <Text fontSize="sm" color="grey.700">
              {new Date(currentCard.targetDateTime).toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </Text>
          </Box>
          <HStack spacing={3}>
            <Button
              colorScheme="blue"
              variant="outline"
              size={{ base: 'sm', md: 'md' }}
              leftIcon={<EditIcon />}
              onClick={handleEdit}
              flex={1}
            >
              Edit Card
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
              Remove Card
            </Button>
          </HStack>
          <Button
            colorScheme="orange"
            size={{ base: 'sm', md: 'md' }}
            onClick={handleResetReminders}
            isLoading={isResetting}
            loadingText="Resetting..."
            w="100%"
          >
            Reset All Reminders
          </Button>
          <Text fontSize="xs" color="grey.600" textAlign="center">
            This will force all users to register again and fire new RudderStack events
          </Text>
        </VStack>
      ) : (
        <form onSubmit={handleSubmit}>
          <VStack align="stretch" spacing={4}>
            <FormControl isRequired>
              <FormLabel color="grey.900" fontWeight="semibold">
                Message
              </FormLabel>
              <Textarea
                placeholder="Enter message to display (e.g., 'Next game starts on Sunday at 8 PM!')"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                color="grey.900"
                borderColor="grey.300"
                rows={3}
              />
              <Text fontSize="xs" color="grey.500" mt={2}>
                This message will be displayed to users in the lobby
              </Text>
            </FormControl>

            <HStack spacing={4}>
              <FormControl isRequired flex={1}>
                <FormLabel color="grey.900" fontWeight="semibold">
                  Target Date
                </FormLabel>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  color="grey.900"
                  borderColor="grey.300"
                />
              </FormControl>

              <FormControl isRequired flex={1}>
                <FormLabel color="grey.900" fontWeight="semibold">
                  Target Time
                </FormLabel>
                <Input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  color="grey.900"
                  borderColor="grey.300"
                />
              </FormControl>
            </HStack>

            <Text fontSize="xs" color="grey.500">
              Countdown timer will show time remaining until this date and time
            </Text>

            <HStack spacing={3}>
              <Button
                type="submit"
                colorScheme="brand"
                size={{ base: 'sm', md: 'md' }}
                isLoading={isSubmitting}
                loadingText={isEditing ? 'Updating...' : 'Creating...'}
                flex={1}
              >
                {isEditing ? 'Update Card' : 'Create Card'}
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  size={{ base: 'sm', md: 'md' }}
                  onClick={handleCancelEdit}
                  flex={1}
                >
                  Cancel
                </Button>
              )}
            </HStack>
          </VStack>
        </form>
      )}
    </Box>
  );
}
