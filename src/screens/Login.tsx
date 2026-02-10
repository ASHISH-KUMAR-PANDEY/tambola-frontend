import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Stack,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
} from '@chakra-ui/react';
import { Logo } from '../components/Logo';
import { MobileOTPLogin } from '../components/auth/MobileOTPLogin';
import { EmailPasswordLogin } from '../components/auth/EmailPasswordLogin';

export default function Login() {
  const location = useLocation();
  const toast = useToast();
  const [tabIndex, setTabIndex] = useState(0); // 0 = Mobile (default), 1 = Email

  const inactivityMessage = (location.state as any)?.message;

  // Show inactivity message if present
  useEffect(() => {
    if (inactivityMessage) {
      toast({
        title: 'सत्र समाप्त',
        description: 'निष्क्रियता के कारण आपको लॉगआउट कर दिया गया था',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [inactivityMessage, toast]);

  return (
    <Container maxW="md" py={{ base: 8, md: 12, lg: 20 }} px={{ base: 4, md: 6 }}>
      <Box
        bg="grey.700"
        p={{ base: 4, md: 6, lg: 8 }}
        borderRadius="lg"
        boxShadow="lg"
        border="1px"
        borderColor="grey.600"
      >
        <Stack spacing={{ base: 4, md: 6 }}>
          <Box display="flex" justifyContent="center" mb={2}>
            <Logo height={{ base: '28px', md: '32px' }} />
          </Box>
          <Heading as="h1" size={{ base: 'lg', md: 'xl' }} textAlign="center" color="white">
            TAMBOLA
          </Heading>
          <Heading as="h2" size={{ base: 'sm', md: 'md' }} textAlign="center" color="grey.600">
            अपने अकाउंट में लॉगिन करें
          </Heading>

          <Tabs
            index={tabIndex}
            onChange={setTabIndex}
            variant="enclosed"
            colorScheme="brand"
          >
            <TabList mb="1em">
              <Tab
                _selected={{ color: 'white', bg: 'brand.500' }}
                fontSize={{ base: 'sm', md: 'md' }}
                flex={1}
              >
                📱 मोबाइल
              </Tab>
              <Tab
                _selected={{ color: 'white', bg: 'brand.500' }}
                fontSize={{ base: 'sm', md: 'md' }}
                flex={1}
              >
                📧 ईमेल
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <MobileOTPLogin />
              </TabPanel>

              <TabPanel px={0}>
                <EmailPasswordLogin />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Stack>
      </Box>
    </Container>
  );
}
