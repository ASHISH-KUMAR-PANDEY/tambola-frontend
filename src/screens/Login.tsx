import { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Heading,
  Text,
  Link,
  Alert,
  AlertIcon,
  FormErrorMessage,
} from '@chakra-ui/react';
import { useAuthStore } from '../stores/authStore';
import { Logo } from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const from = (location.state as any)?.from?.pathname || '/lobby';

  const validateEmail = (email: string): boolean => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const emailValid = validateEmail(email);
    const passwordValid = validatePassword(password);

    if (!emailValid || !passwordValid) {
      return;
    }

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // Error is handled by store
    }
  };

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

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!emailError}>
                <FormLabel fontSize={{ base: 'sm', md: 'md' }}>ईमेल</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => validateEmail(email)}
                  placeholder="अपना ईमेल दर्ज करें"
                  size={{ base: 'md', md: 'lg' }}
                />
                <FormErrorMessage fontSize="xs">{emailError}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!passwordError}>
                <FormLabel fontSize={{ base: 'sm', md: 'md' }}>पासवर्ड</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => validatePassword(password)}
                  placeholder="अपना पासवर्ड दर्ज करें"
                  size={{ base: 'md', md: 'lg' }}
                />
                <FormErrorMessage fontSize="xs">{passwordError}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                colorScheme="brand"
                size={{ base: 'md', md: 'lg' }}
                fontSize={{ base: 'sm', md: 'md' }}
                isLoading={isLoading}
                loadingText="लॉगिन हो रहा है..."
              >
                लॉगिन करें
              </Button>
            </Stack>
          </form>

          <Text textAlign="center" color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            क्या आपका अकाउंट नहीं है?{' '}
            <Link as={RouterLink} to="/signup" color="brand.500" fontWeight="semibold">
              साइन अप करें
            </Link>
          </Text>
        </Stack>
      </Box>
    </Container>
  );
}
