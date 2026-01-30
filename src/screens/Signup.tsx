import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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

export default function Signup() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const validateName = (name: string): boolean => {
    if (!name) {
      setNameError('Name is required');
      return false;
    }
    if (name.length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    }
    setNameError('');
    return true;
  };

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

  const validateConfirmPassword = (confirmPassword: string): boolean => {
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      return false;
    }
    if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const nameValid = validateName(name);
    const emailValid = validateEmail(email);
    const passwordValid = validatePassword(password);
    const confirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!nameValid || !emailValid || !passwordValid || !confirmPasswordValid) {
      return;
    }

    try {
      await signup(email, password, name);
      navigate('/lobby', { replace: true });
    } catch (err) {
      // Error is handled by store
    }
  };

  return (
    <Container maxW="md" py={{ base: 8, md: 12, lg: 20 }} px={{ base: 4, md: 6 }}>
      <Box
        bg="white"
        p={{ base: 4, md: 6, lg: 8 }}
        borderRadius="lg"
        boxShadow="lg"
        border="1px"
        borderColor="gray.200"
      >
        <Stack spacing={{ base: 4, md: 6 }}>
          <Heading as="h1" size={{ base: 'lg', md: 'xl' }} textAlign="center" color="brand.500">
            Tambola Game
          </Heading>
          <Heading as="h2" size={{ base: 'sm', md: 'md' }} textAlign="center" color="gray.600">
            Create your account
          </Heading>

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!nameError}>
                <FormLabel fontSize={{ base: 'sm', md: 'md' }}>Name</FormLabel>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => validateName(name)}
                  placeholder="Enter your name"
                  size={{ base: 'md', md: 'lg' }}
                />
                <FormErrorMessage fontSize="xs">{nameError}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!emailError}>
                <FormLabel fontSize={{ base: 'sm', md: 'md' }}>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => validateEmail(email)}
                  placeholder="Enter your email"
                  size={{ base: 'md', md: 'lg' }}
                />
                <FormErrorMessage fontSize="xs">{emailError}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!passwordError}>
                <FormLabel fontSize={{ base: 'sm', md: 'md' }}>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => validatePassword(password)}
                  placeholder="Enter your password"
                  size={{ base: 'md', md: 'lg' }}
                />
                <FormErrorMessage fontSize="xs">{passwordError}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!confirmPasswordError}>
                <FormLabel fontSize={{ base: 'sm', md: 'md' }}>Confirm Password</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => validateConfirmPassword(confirmPassword)}
                  placeholder="Confirm your password"
                  size={{ base: 'md', md: 'lg' }}
                />
                <FormErrorMessage fontSize="xs">{confirmPasswordError}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                colorScheme="brand"
                size={{ base: 'md', md: 'lg' }}
                fontSize={{ base: 'sm', md: 'md' }}
                isLoading={isLoading}
                loadingText="Creating account..."
              >
                Sign Up
              </Button>
            </Stack>
          </form>

          <Text textAlign="center" color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            Already have an account?{' '}
            <Link as={RouterLink} to="/login" color="brand.500" fontWeight="semibold">
              Login
            </Link>
          </Text>
        </Stack>
      </Box>
    </Container>
  );
}
