import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertIcon } from '@chakra-ui/react';
import { SendOTPForm } from './SendOTPForm';
import { VerifyOTPForm } from './VerifyOTPForm';
import { apiService } from '../../services/api.service';
import { stageApiService } from '../../services/stage-api.service';
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
      // Call Stage API directly (frontend → Stage API)
      const response = await stageApiService.sendOTP(mobileNumber);

      if (response.success) {
        setOtpId(response.otpId);
        setStep('VERIFY_OTP');

        // Track OTP sent event
        trackEvent({
          eventName: 'otp_sent',
          properties: {
            mobile_number: `XXXX${mobileNumber.slice(-4)}`,
            method: 'SMS',
            provider: 'Stage',
          },
        });
      } else {
        setError(response.message || 'OTP भेजने में त्रुटि। कृपया पुन: प्रयास करें।');
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
      // Step 1: Verify OTP via Stage API (frontend → Stage API)
      const stageResponse = await stageApiService.verifyOTP(otpId, mobileNumber, otp);

      if (!stageResponse.success) {
        setError(stageResponse.message || 'OTP सत्यापन में त्रुटि। कृपया पुन: प्रयास करें।');
        return;
      }

      // Step 2: Validate user with Tambola backend using Stage userId (frontend → Tambola backend)
      const userId = stageResponse.userId!;
      const tambolaResponse = await apiService.validateUser(userId);

      // Save userId to localStorage
      localStorage.setItem('app_user_id', userId);

      // Save userName if available
      if (tambolaResponse.user.name) {
        sessionStorage.setItem('playerName', tambolaResponse.user.name);
      }

      // Set user in authStore
      setUser({
        id: userId,
        email: tambolaResponse.user.email || `${mobileNumber}@tambola.com`,
        name: tambolaResponse.user.name || 'Player',
      });

      // Track analytics
      trackEvent({
        eventName: 'user_logged_in_via_stage_otp',
        properties: {
          mobile_number: `XXXX${mobileNumber.slice(-4)}`,
          stage_user_id: userId,
        },
      });

      // Connect WebSocket
      wsService.connect(userId);

      // Redirect to lobby
      navigate('/lobby');
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
