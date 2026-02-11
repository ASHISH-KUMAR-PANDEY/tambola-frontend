import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertIcon } from '@chakra-ui/react';
import { SendOTPForm } from './SendOTPForm';
import { VerifyOTPForm } from './VerifyOTPForm';
import { apiService } from '../../services/api.service';
import { useAuthStore } from '../../stores/authStore';
import { wsService } from '../../services/websocket.service';
import { useTambolaTracking } from '../../hooks/useTambolaTracking';

export function MobileOTPLogin() {
  const [step, setStep] = useState<'SEND_OTP' | 'VERIFY_OTP'>('SEND_OTP');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpId, setOtpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { trackEvent } = useTambolaTracking();

  const handleSendOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.sendOTP({
        mobileNumber,
        countryCode: '+91',
      });

      if (response.success) {
        setOtpId(response.otpId);
        setStep('VERIFY_OTP');

        // Track OTP sent event
        trackEvent({
          eventName: 'otp_sent',
          properties: {
            mobile_number: `XXXX${mobileNumber.slice(-4)}`,
            method: 'SMS',
          },
        });
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setError(err.message || 'OTP भेजने में त्रुटि। कृपया पुन: प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.verifyOTP({
        mobileNumber,
        otp,
        otpId,
      });

      if (response.success) {
        // Save userId to localStorage
        localStorage.setItem('app_user_id', response.userId);

        // Save userName if available (use localStorage for persistence)
        if (response.userName) {
          localStorage.setItem('playerName', response.userName);
        }

        // Set user in authStore
        setUser({
          id: response.userId,
          email: response.mobileNumber ? `${response.mobileNumber}@tambola.com` : '',
          name: response.userName || 'Player',
        });

        // Track analytics
        trackEvent({
          eventName: 'user_logged_in_via_otp',
          properties: {
            mobile_number: `XXXX${mobileNumber.slice(-4)}`,
            is_new_user: response.isNewUser,
          },
        });

        // Connect WebSocket
        wsService.connect(response.userId);

        // Redirect to lobby
        navigate('/lobby');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setError(err.message || 'OTP सत्यापन में त्रुटि। कृपया पुन: प्रयास करें।');

      // If OTP is invalid, allow user to try again
      if (err.message?.includes('Invalid') || err.message?.includes('expired')) {
        // Don't go back to send OTP step, let them try entering OTP again
        // Or they can click resend
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setStep('SEND_OTP');
    setOtpId('');
    setError('');
    // Don't clear mobile number, let user resend to same number
    await handleSendOTP();
  };

  return (
    <>
      {error && (
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {step === 'SEND_OTP' && (
        <SendOTPForm
          mobileNumber={mobileNumber}
          setMobileNumber={setMobileNumber}
          onSubmit={handleSendOTP}
          loading={loading}
        />
      )}

      {step === 'VERIFY_OTP' && (
        <VerifyOTPForm
          mobileNumber={mobileNumber}
          onSubmit={handleVerifyOTP}
          onResend={handleResendOTP}
          loading={loading}
        />
      )}
    </>
  );
}
