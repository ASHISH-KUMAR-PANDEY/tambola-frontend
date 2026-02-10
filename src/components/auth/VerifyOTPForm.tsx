import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Stack,
  Text,
  HStack,
  PinInput,
  PinInputField,
  FormControl,
  FormErrorMessage,
  Box,
} from '@chakra-ui/react';

interface VerifyOTPFormProps {
  mobileNumber: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  loading: boolean;
}

export function VerifyOTPForm({
  mobileNumber,
  onSubmit,
  onResend,
  loading,
}: VerifyOTPFormProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleChange = (value: string) => {
    setOtp(value);
    setError('');

    // Auto-submit when all 6 digits are entered
    if (value.length === 6) {
      onSubmit(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      setError('कृपया 6 अंकों का OTP दर्ज करें');
      return;
    }

    onSubmit(otp);
  };

  const handleResend = () => {
    if (!canResend) return;
    setOtp('');
    setCountdown(30);
    setCanResend(false);
    setError('');
    onResend();
  };

  return (
    <Box>
      <Stack spacing={4} align="center">
        <Box textAlign="center">
          <Text fontSize="sm" color="gray.600" mb={1}>
            OTP भेजा गया है
          </Text>
          <Text fontSize="sm" fontWeight="medium" color="gray.900">
            +91 {mobileNumber}
          </Text>
        </Box>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <Stack spacing={4}>
            <FormControl isInvalid={!!error}>
              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                fontWeight="medium"
                textAlign="center"
                mb={3}
              >
                6 अंकों का OTP दर्ज करें
              </Text>
              <HStack justify="center">
                <PinInput
                  otp
                  size={{ base: 'md', md: 'lg' }}
                  value={otp}
                  onChange={handleChange}
                  isDisabled={loading}
                >
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                </PinInput>
              </HStack>
              {error && (
                <FormErrorMessage fontSize="xs" textAlign="center" mt={2}>
                  {error}
                </FormErrorMessage>
              )}
            </FormControl>

            <Button
              type="submit"
              colorScheme="brand"
              size={{ base: 'md', md: 'lg' }}
              fontSize={{ base: 'sm', md: 'md' }}
              isLoading={loading}
              loadingText="सत्यापित कर रहे हैं..."
              isDisabled={otp.length !== 6}
            >
              सत्यापित करें
            </Button>
          </Stack>
        </form>

        <Button
          variant="link"
          colorScheme="brand"
          size="sm"
          onClick={handleResend}
          isDisabled={!canResend || loading}
        >
          {canResend ? 'OTP फिर से भेजें' : `OTP फिर से भेजें (${countdown}s)`}
        </Button>
      </Stack>
    </Box>
  );
}
