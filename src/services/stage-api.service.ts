/**
 * Stage API Service
 * Calls Stage's backend directly for OTP functionality
 * Stage handles SMS delivery using their MSG91 account
 */

const STAGE_API_BASE_URL = 'https://api.stage.in';

interface StageGetOTPRequest {
  mobileNumber: string;
  deviceId: string;
  lang: string;
  type: string;
}

interface StageGetOTPResponse {
  responseCode: number;
  data?: {
    id: string; // OTP session ID
    toastMessage?: string;
  };
  responseMessage?: string;
}

interface StageVerifyOTPRequest {
  id: string;
  mobileNumber: string;
  otp: string;
}

interface StageVerifyOTPResponse {
  responseCode: number;
  data?: {
    UserDetail: {
      _id: string;
      primaryMobileNumber: string;
      subscriptionStatus: number;
      primaryLanguage: string;
      [key: string]: any;
    };
    access: string; // Stage's access token (we won't use this)
  };
  responseMessage?: string;
}

class StageApiService {
  /**
   * Generate a device ID for Stage API
   */
  private generateDeviceId(): string {
    return `tambola_web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send OTP via Stage's API
   * Stage handles SMS delivery using their MSG91 account
   */
  async sendOTP(mobileNumber: string): Promise<{
    success: boolean;
    otpId: string;
    message?: string;
  }> {
    try {
      const deviceId = this.generateDeviceId();

      const response = await fetch(`${STAGE_API_BASE_URL}/v20/user/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          mobileNumber,
          deviceId,
          lang: 'hin', // Hindi
          type: 'web',
        } as StageGetOTPRequest),
      });

      const data = (await response.json()) as StageGetOTPResponse;

      if (data.responseCode === 200 && data.data?.id) {
        console.log(`[StageAPI] OTP sent successfully to ${mobileNumber}`);
        return {
          success: true,
          otpId: data.data.id,
        };
      } else {
        console.error('[StageAPI] Failed to send OTP:', data.responseMessage);
        return {
          success: false,
          otpId: '',
          message:
            data.data?.toastMessage ||
            data.responseMessage ||
            'Failed to send OTP',
        };
      }
    } catch (error) {
      console.error('[StageAPI] Error sending OTP:', error);
      return {
        success: false,
        otpId: '',
        message: 'Network error while sending OTP',
      };
    }
  }

  /**
   * Verify OTP via Stage's API
   * Returns Stage userId if OTP is valid
   */
  async verifyOTP(
    otpId: string,
    mobileNumber: string,
    otp: string
  ): Promise<{
    success: boolean;
    userId?: string;
    mobileNumber?: string;
    message?: string;
  }> {
    try {
      const response = await fetch(`${STAGE_API_BASE_URL}/v23/user/verifyOtp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          id: otpId,
          mobileNumber,
          otp,
        } as StageVerifyOTPRequest),
      });

      const data = (await response.json()) as StageVerifyOTPResponse;

      if (data.responseCode === 200 && data.data?.UserDetail) {
        console.log(
          `[StageAPI] OTP verified successfully for ${mobileNumber}, userId: ${data.data.UserDetail._id}`
        );
        return {
          success: true,
          userId: data.data.UserDetail._id,
          mobileNumber: data.data.UserDetail.primaryMobileNumber,
        };
      } else {
        console.error('[StageAPI] Failed to verify OTP:', data.responseMessage);
        return {
          success: false,
          message: data.responseMessage || 'Invalid or expired OTP',
        };
      }
    } catch (error) {
      console.error('[StageAPI] Error verifying OTP:', error);
      return {
        success: false,
        message: 'Network error while verifying OTP',
      };
    }
  }
}

// Export singleton instance
export const stageApiService = new StageApiService();
