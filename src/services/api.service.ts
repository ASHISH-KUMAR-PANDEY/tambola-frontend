const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Validate userId - reject invalid values
function isValidUserId(id: string | null): boolean {
  if (!id) return false;

  // Convert to lowercase for case-insensitive check
  const idLower = id.toLowerCase();

  // List of invalid route names and reserved words
  const invalidValues = [
    'lobby', 'login', 'signup', 'organizer', 'game',
    'waiting-lobby', 'undefined', 'null', 'admin'
  ];

  if (invalidValues.includes(idLower)) {
    return false;
  }

  // UserId should be at least 10 characters (reasonable for ObjectId or UUID)
  if (id.length < 10) {
    return false;
  }

  return true;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'PLAYER' | 'ORGANIZER';
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Game {
  id: string;
  scheduledTime: string;
  startedAt?: string;
  endedAt?: string;
  status: 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdBy: string;
  prizes: {
    early5?: number;
    topLine?: number;
    middleLine?: number;
    bottomLine?: number;
    fullHouse?: number;
  };
  calledNumbers: number[];
  currentNumber?: number;
  playerCount?: number;
  winnerCount?: number;
  ticket?: number[][];
  playerId?: string;
  markedNumbers?: number[];
}

export interface CreateGameRequest {
  scheduledTime: string;
  prizes: {
    early5?: number;
    topLine?: number;
    middleLine?: number;
    bottomLine?: number;
    fullHouse?: number;
  };
}

class ApiService {
  private token: string | null = null;

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  /**
   * Get authentication token
   */
  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Only set Content-Type for requests with a body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'An error occurred',
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    // Handle 204 No Content response
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * Sign up new user
   */
  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  /**
   * Login existing user
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  /**
   * Validate user by userId (for mobile app auto-login)
   */
  async validateUser(userId: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/validate-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    this.setToken(response.token);
    return response;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ user: User }>('/api/v1/auth/me');
    return response.user;
  }

  /**
   * Logout user
   */
  logout(): void {
    this.clearToken();
  }

  /**
   * Update user profile (name)
   */
  async updateUserProfile(data: { name: string }): Promise<{
    success: boolean;
    message: string;
    user: User;
  }> {
    // For mobile app users, include userId in the body
    const rawAppUserId = localStorage.getItem('app_user_id');
    const appUserId = isValidUserId(rawAppUserId) ? rawAppUserId : null;

    const body = appUserId
      ? { ...data, userId: appUserId }
      : data;

    return this.request('/api/v1/auth/update-profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get user profile by userId (for mobile app users)
   */
  async getUserProfile(userId: string): Promise<{
    success: boolean;
    user: User;
  }> {
    return this.request(`/api/v1/auth/profile/${userId}`, {
      method: 'GET',
    });
  }

  /**
   * Send OTP to mobile number
   */
  async sendOTP(data: {
    mobileNumber: string;
    countryCode: string;
  }): Promise<{
    success: boolean;
    message: string;
    otpId: string;
    expiresIn: number;
    attemptsRemaining: number;
  }> {
    return this.request('/api/v1/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Verify OTP and login/signup user
   */
  async verifyOTP(data: {
    mobileNumber: string;
    otp: string;
    otpId: string;
  }): Promise<{
    success: boolean;
    isNewUser: boolean;
    userId: string;
    userName: string | null;
    mobileNumber: string;
    accessToken: string;
  }> {
    const response = await this.request<{
      success: boolean;
      isNewUser: boolean;
      userId: string;
      userName: string | null;
      mobileNumber: string;
      accessToken: string;
    }>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.accessToken);
    return response;
  }

  /**
   * Create a new game
   */
  async createGame(data: CreateGameRequest): Promise<Game> {
    return this.request<Game>('/api/v1/games', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get list of games
   */
  async getGames(status?: string): Promise<Game[]> {
    const rawAppUserId = localStorage.getItem('app_user_id');
    // Filter out invalid userId values
    const appUserId = isValidUserId(rawAppUserId) ? rawAppUserId : null;

    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (appUserId) params.append('userId', appUserId);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Game[]>(`/api/v1/games${query}`);
  }

  /**
   * Get game by ID
   */
  async getGame(gameId: string): Promise<Game> {
    return this.request<Game>(`/api/v1/games/${gameId}`);
  }

  /**
   * Update game status
   */
  async updateGameStatus(
    gameId: string,
    status: 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  ): Promise<Game> {
    return this.request<Game>(`/api/v1/games/${gameId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Delete game
   */
  async deleteGame(gameId: string): Promise<void> {
    await this.request<void>(`/api/v1/games/${gameId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get player's active games (can rejoin)
   */
  async getMyActiveGames(): Promise<Game[]> {
    const rawAppUserId = localStorage.getItem('app_user_id');
    // Filter out invalid userId values
    const appUserId = isValidUserId(rawAppUserId) ? rawAppUserId : null;
    const query = appUserId ? `?userId=${appUserId}` : '';
    const response = await this.request<{ games: Game[] }>(`/api/v1/games/my-active${query}`);
    return response.games;
  }

  /**
   * Get presigned URL for direct S3 upload
   */
  async getPresignedUploadUrl(fileName: string, fileSize: number, mimeType: string): Promise<{
    presignedUrl: string;
    s3Key: string;
    publicUrl: string;
    expiresIn: number;
  }> {
    return this.request<{
      presignedUrl: string;
      s3Key: string;
      publicUrl: string;
      expiresIn: number;
    }>('/api/v1/promotional-banner/presigned-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileSize, mimeType }),
    });
  }

  /**
   * Upload file directly to S3 using presigned URL
   */
  async uploadToS3(presignedUrl: string, file: File): Promise<void> {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to S3: ${response.status}`);
    }
  }

  /**
   * Validate uploaded banner and save metadata
   */
  async validateUploadedBanner(s3Key: string, publicUrl: string, fileSize: number): Promise<PromotionalBanner> {
    return this.request<PromotionalBanner>('/api/v1/promotional-banner/validate', {
      method: 'POST',
      body: JSON.stringify({ s3Key, publicUrl, fileSize }),
    });
  }

  /**
   * Upload promotional banner (legacy method - uses backend proxy)
   */
  async uploadPromotionalBanner(file: File): Promise<PromotionalBanner> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/v1/promotional-banner/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to upload promotional banner',
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Upload promotional banner using presigned S3 URL (recommended)
   */
  async uploadPromotionalBannerDirect(file: File): Promise<PromotionalBanner> {
    // Step 1: Get presigned URL
    const { presignedUrl, s3Key, publicUrl } = await this.getPresignedUploadUrl(
      file.name,
      file.size,
      file.type
    );

    // Step 2: Upload directly to S3
    await this.uploadToS3(presignedUrl, file);

    // Step 3: Validate and save metadata
    return this.validateUploadedBanner(s3Key, publicUrl, file.size);
  }

  /**
   * Get current promotional banner
   */
  async getCurrentPromotionalBanner(): Promise<PromotionalBanner | null> {
    const response = await this.request<{ banner: PromotionalBanner | null }>(
      '/api/v1/promotional-banner'
    );
    return response.banner;
  }

  /**
   * Delete promotional banner
   */
  async deletePromotionalBanner(): Promise<void> {
    await this.request<void>('/api/v1/promotional-banner', {
      method: 'DELETE',
    });
  }

  /**
   * Set YouTube embed
   */
  async setYouTubeEmbed(videoUrl: string): Promise<YouTubeEmbed> {
    return this.request<YouTubeEmbed>('/api/v1/youtube-embed', {
      method: 'POST',
      body: JSON.stringify({ videoUrl }),
    });
  }

  /**
   * Get current YouTube embed
   */
  async getCurrentYouTubeEmbed(): Promise<YouTubeEmbed | null> {
    const response = await this.request<{ embed: YouTubeEmbed | null }>(
      '/api/v1/youtube-embed'
    );
    return response.embed;
  }

  /**
   * Delete YouTube embed
   */
  async deleteYouTubeEmbed(): Promise<void> {
    await this.request<void>('/api/v1/youtube-embed', {
      method: 'DELETE',
    });
  }

  /**
   * Set YouTube live stream
   */
  async setYouTubeLiveStream(videoUrl: string): Promise<YouTubeLiveStream> {
    return this.request<YouTubeLiveStream>('/api/v1/youtube-livestream', {
      method: 'POST',
      body: JSON.stringify({ videoUrl }),
    });
  }

  /**
   * Get current YouTube live stream
   */
  async getCurrentYouTubeLiveStream(): Promise<YouTubeLiveStream | null> {
    const response = await this.request<{ stream: YouTubeLiveStream | null }>(
      '/api/v1/youtube-livestream'
    );
    return response.stream;
  }

  /**
   * Create registration card
   */
  async createRegistrationCard(message: string, targetDateTime: string): Promise<RegistrationCard> {
    return this.request<RegistrationCard>('/api/v1/registration-card', {
      method: 'POST',
      body: JSON.stringify({ message, targetDateTime }),
    });
  }

  /**
   * Get active registration card
   */
  async getActiveRegistrationCard(): Promise<RegistrationCard | null> {
    const response = await this.request<{ card: RegistrationCard | null }>(
      '/api/v1/registration-card'
    );
    return response.card;
  }

  /**
   * Update registration card
   */
  async updateRegistrationCard(
    id: string,
    data: { message?: string; targetDateTime?: string; isActive?: boolean }
  ): Promise<RegistrationCard> {
    return this.request<RegistrationCard>(`/api/v1/registration-card/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete registration card
   */
  async deleteRegistrationCard(id: string): Promise<void> {
    await this.request<void>(`/api/v1/registration-card/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Delete YouTube live stream
   */
  async deleteYouTubeLiveStream(): Promise<void> {
    await this.request<void>('/api/v1/youtube-livestream', {
      method: 'DELETE',
    });
  }

  /**
   * Upload VIP cohort CSV file (replaces existing list)
   */
  async uploadVIPCohort(file: File): Promise<{ success: boolean; count: number; message: string }> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/v1/vip-cohort/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Failed to upload VIP cohort');
    }

    return response.json();
  }

  /**
   * Download current VIP cohort as CSV file
   */
  async downloadVIPCohort(): Promise<Blob> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/api/v1/vip-cohort/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(error.message || 'Failed to download VIP cohort');
    }

    return response.blob();
  }

  /**
   * Get VIP cohort statistics
   */
  async getVIPStats(): Promise<{ success: boolean; count: number; sampleUsers: string[] }> {
    return this.request<{ success: boolean; count: number; sampleUsers: string[] }>(
      '/api/v1/vip-cohort/stats'
    );
  }
}

export interface PromotionalBanner {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface YouTubeEmbed {
  id: string;
  videoUrl: string;
  embedId: string;
  createdAt: string;
}

export interface YouTubeLiveStream {
  id: string;
  videoUrl: string;
  embedId: string;
  createdAt: string;
}

export interface RegistrationCard {
  id: string;
  message: string;
  targetDateTime: string;
  isActive: boolean;
  createdAt: string;
}

// Export singleton instance
export const apiService = new ApiService();
