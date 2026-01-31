import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Divider,
  Icon,
} from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';

export interface Winner {
  playerId: string;
  category: string;
  userName?: string;
}

interface GameSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  winners: Winner[];
  isOrganizer?: boolean;
}

const PRIZE_CATEGORIES = [
  { key: 'EARLY_5', labelHi: 'अर्ली 5', labelEn: 'Early 5' },
  { key: 'TOP_LINE', labelHi: 'टॉप लाइन', labelEn: 'Top Line' },
  { key: 'MIDDLE_LINE', labelHi: 'मिडिल लाइन', labelEn: 'Middle Line' },
  { key: 'BOTTOM_LINE', labelHi: 'बॉटम लाइन', labelEn: 'Bottom Line' },
  { key: 'FULL_HOUSE', labelHi: 'फुल हाउस', labelEn: 'Full House' },
];

export const GameSummaryModal = ({
  isOpen,
  onClose,
  winners,
  isOrganizer = false,
}: GameSummaryModalProps) => {
  const getWinnerForCategory = (category: string) => {
    return winners.find((w) => w.category === category);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }} isCentered>
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
      <ModalContent
        bg={isOrganizer ? 'white' : 'grey.800'}
        mx={{ base: 0, md: 4 }}
        my={{ base: 0, md: 4 }}
      >
        <ModalHeader
          textAlign="center"
          fontSize={{ base: 'xl', md: '2xl' }}
          fontWeight="bold"
          color={isOrganizer ? 'grey.900' : 'white'}
          pt={8}
        >
          <VStack spacing={2}>
            <Icon
              as={CheckCircleIcon}
              boxSize={{ base: 12, md: 16 }}
              color="green.500"
            />
            <Text>{isOrganizer ? 'Game Complete!' : 'गेम समाप्त!'}</Text>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="normal" color={isOrganizer ? 'grey.600' : 'grey.400'}>
              {isOrganizer ? 'Game Summary' : 'खेलने के लिए धन्यवाद'}
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton color={isOrganizer ? 'grey.600' : 'grey.400'} />

        <ModalBody py={6}>
          <VStack align="stretch" spacing={4}>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              textAlign="center"
              color={isOrganizer ? 'brand.600' : 'brand.400'}
              mb={2}
            >
              {isOrganizer ? 'Leaderboard' : 'लीडरबोर्ड'}
            </Text>

            <Divider borderColor={isOrganizer ? 'grey.200' : 'grey.700'} />

            {PRIZE_CATEGORIES.map(({ key, labelHi, labelEn }) => {
              const winner = getWinnerForCategory(key);
              return (
                <Box
                  key={key}
                  p={4}
                  bg={isOrganizer ? 'grey.50' : 'grey.700'}
                  borderRadius="md"
                  border="1px"
                  borderColor={winner ? (isOrganizer ? 'green.200' : 'green.700') : (isOrganizer ? 'grey.200' : 'grey.600')}
                  transition="all 0.2s"
                >
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0}>
                      <Text
                        fontWeight="bold"
                        fontSize={{ base: 'md', md: 'lg' }}
                        color={isOrganizer ? 'grey.900' : 'white'}
                      >
                        {isOrganizer ? labelEn : labelHi}
                      </Text>
                    </VStack>

                    {winner ? (
                      <VStack align="end" spacing={0}>
                        <HStack spacing={2}>
                          <Icon as={CheckCircleIcon} color="green.500" boxSize={5} />
                          <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
                            {winner.userName || 'Player'}
                          </Badge>
                        </HStack>
                      </VStack>
                    ) : (
                      <Badge colorScheme="grey" fontSize="sm" px={3} py={1}>
                        {isOrganizer ? 'No Winner' : 'कोई विजेता नहीं'}
                      </Badge>
                    )}
                  </HStack>
                </Box>
              );
            })}

            <Box
              mt={4}
              p={4}
              bg={isOrganizer ? 'brand.50' : 'brand.900'}
              borderRadius="md"
              borderLeft="4px"
              borderColor="brand.500"
            >
              <HStack justify="space-between">
                <Text fontWeight="bold" color={isOrganizer ? 'brand.700' : 'brand.300'}>
                  {isOrganizer ? 'Total Winners:' : 'कुल विजेता:'}
                </Text>
                <Text fontWeight="bold" fontSize="xl" color={isOrganizer ? 'brand.600' : 'brand.400'}>
                  {winners.length}/5
                </Text>
              </HStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="brand"
            size={{ base: 'md', md: 'lg' }}
            w="full"
            onClick={onClose}
          >
            {isOrganizer ? 'Close' : 'बंद करें'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
