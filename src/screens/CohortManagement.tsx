import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  VStack,
  Text,
  HStack,
  Input,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  CardHeader,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { DownloadIcon, UploadIcon } from '@chakra-ui/icons';
import { Logo } from '../components/Logo';
import { apiService } from '../services/api.service';

interface VIPStats {
  success: boolean;
  count: number;
  sampleUsers: string[];
}

export default function CohortManagement() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const [vipStats, setVipStats] = useState<VIPStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    loadVIPStats();
  }, []);

  const loadVIPStats = async () => {
    try {
      const stats = await apiService.getVIPStats();
      setVipStats(stats);
    } catch (error) {
      console.error('Failed to load VIP stats:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: 'अमान्य फ़ाइल',
          description: 'कृपया एक CSV फ़ाइल चुनें',
          status: 'error',
          duration: 3000,
        });
        return;
      }
      setSelectedFile(file);
      onOpen(); // Open confirmation dialog
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    onClose(); // Close confirmation dialog

    try {
      const result = await apiService.uploadVIPCohort(selectedFile);
      toast({
        title: 'सफलतापूर्वक अपलोड हुआ',
        description: `${result.count} VIP सदस्य जोड़े गए`,
        status: 'success',
        duration: 5000,
      });

      // Reload stats
      await loadVIPStats();
      setSelectedFile(null);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: 'अपलोड विफल',
        description: error instanceof Error ? error.message : 'VIP सूची अपलोड करने में विफल',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      const blob = await apiService.downloadVIPCohort();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vip-users-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'डाउनलोड सफल',
        description: 'VIP सूची डाउनलोड हो गई',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'डाउनलोड विफल',
        description: error instanceof Error ? error.message : 'VIP सूची डाउनलोड करने में विफल',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    onClose();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            VIP Cohort Management
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
          {/* VIP Stats Card */}
          <Card w="100%" bg="white">
            <CardHeader>
              <Heading size="md" color="grey.900">
                VIP सदस्य सांख्यिकी
              </Heading>
            </CardHeader>
            <CardBody>
              <Stat>
                <StatLabel color="grey.700">कुल VIP सदस्य</StatLabel>
                <StatNumber color="grey.900" fontSize="4xl">
                  {vipStats?.count || 0}
                </StatNumber>
                <StatHelpText color="grey.600">
                  ये सदस्य सभी गेम्स में शामिल हो सकते हैं
                </StatHelpText>
              </Stat>

              {vipStats && vipStats.sampleUsers.length > 0 && (
                <Box mt={4}>
                  <Text fontSize="sm" color="grey.700" fontWeight="semibold" mb={2}>
                    नमूना User IDs (पहले 10):
                  </Text>
                  <VStack align="stretch" spacing={1}>
                    {vipStats.sampleUsers.slice(0, 5).map((userId, index) => (
                      <Text key={index} fontSize="xs" color="grey.600" fontFamily="mono">
                        {userId}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              )}
            </CardBody>
          </Card>

          {/* Upload/Download Card */}
          <Card w="100%" bg="white">
            <CardHeader>
              <Heading size="md" color="grey.900">
                VIP सूची प्रबंधन
              </Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="sm" color="grey.700" mb={3}>
                    CSV फ़ाइल अपलोड करें जिसमें VIP सदस्यों के userId हों। मौजूदा सूची को बदल देगा।
                  </Text>
                  <Text fontSize="xs" color="grey.600" mb={4}>
                    CSV फॉर्मेट: एक हेडर "userId" और फिर प्रति लाइन एक userId
                  </Text>

                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    display="none"
                  />

                  <HStack spacing={4}>
                    <Button
                      leftIcon={<UploadIcon />}
                      colorScheme="teal"
                      onClick={() => fileInputRef.current?.click()}
                      isLoading={isLoading}
                      isDisabled={isLoading}
                    >
                      CSV अपलोड करें
                    </Button>

                    <Button
                      leftIcon={<DownloadIcon />}
                      colorScheme="blue"
                      variant="outline"
                      onClick={handleDownload}
                      isLoading={isLoading}
                      isDisabled={isLoading || !vipStats || vipStats.count === 0}
                    >
                      मौजूदा सूची डाउनलोड करें
                    </Button>
                  </HStack>
                </Box>

                {selectedFile && (
                  <Box
                    p={3}
                    bg="blue.50"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="blue.200"
                  >
                    <Text fontSize="sm" color="blue.900" fontWeight="semibold">
                      चयनित फ़ाइल: {selectedFile.name}
                    </Text>
                    <Text fontSize="xs" color="blue.700" mt={1}>
                      आकार: {(selectedFile.size / 1024).toFixed(2)} KB
                    </Text>
                  </Box>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Instructions Card */}
          <Card w="100%" bg="yellow.50" borderColor="yellow.200" borderWidth="1px">
            <CardHeader>
              <Heading size="sm" color="grey.900">
                ⚠️ महत्वपूर्ण सूचना
              </Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" color="grey.800">
                  • CSV अपलोड करने पर मौजूदा VIP सूची पूरी तरह से बदल जाएगी
                </Text>
                <Text fontSize="sm" color="grey.800">
                  • केवल VIP सूची में शामिल सदस्य ही गेम्स देख और खेल सकते हैं
                </Text>
                <Text fontSize="sm" color="grey.800">
                  • गेम Organizers को VIP होने की आवश्यकता नहीं है
                </Text>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </VStack>

      {/* Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={handleCancelUpload}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              VIP सूची बदलें?
            </AlertDialogHeader>

            <AlertDialogBody>
              क्या आप वाकई VIP सूची को बदलना चाहते हैं? यह {vipStats?.count || 0} मौजूदा
              VIP सदस्यों को हटा देगा और नई सूची से बदल देगा।
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={handleCancelUpload}>
                रद्द करें
              </Button>
              <Button colorScheme="red" onClick={handleUpload} ml={3} isLoading={isLoading}>
                हां, बदलें
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
