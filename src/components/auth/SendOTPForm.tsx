import { useState } from 'react';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftAddon,
  Stack,
  FormErrorMessage,
} from '@chakra-ui/react';

interface SendOTPFormProps {
  mobileNumber: string;
  setMobileNumber: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function SendOTPForm({
  mobileNumber,
  setMobileNumber,
  onSubmit,
  loading,
}: SendOTPFormProps) {
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate mobile number (exactly 10 digits)
    if (!/^\d{10}$/.test(mobileNumber)) {
      setError('कृपया 10 अंकों का मोबाइल नंबर दर्ज करें');
      return;
    }

    onSubmit();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 10) {
      setMobileNumber(value);
      setError('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={4}>
        <FormControl isInvalid={!!error}>
          <FormLabel fontSize={{ base: 'sm', md: 'md' }}>मोबाइल नंबर</FormLabel>
          <InputGroup size={{ base: 'md', md: 'lg' }}>
            <InputLeftAddon>+91</InputLeftAddon>
            <Input
              type="tel"
              value={mobileNumber}
              onChange={handleChange}
              placeholder="9876543210"
              disabled={loading}
              autoComplete="tel"
              maxLength={10}
            />
          </InputGroup>
          <FormErrorMessage fontSize="xs">{error}</FormErrorMessage>
        </FormControl>

        <Button
          type="submit"
          colorScheme="brand"
          size={{ base: 'md', md: 'lg' }}
          fontSize={{ base: 'sm', md: 'md' }}
          isLoading={loading}
          loadingText="OTP भेज रहे हैं..."
          isDisabled={mobileNumber.length !== 10}
        >
          OTP भेजें
        </Button>
      </Stack>
    </form>
  );
}
