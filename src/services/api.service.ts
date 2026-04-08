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
  winners?: Array<{ playerId: string; category: string; userName?: string }>;
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

  async resetAllReminders(id: string): Promise<RegistrationCard> {
    return this.request<RegistrationCard>(`/api/v1/registration-card/${id}/reset-reminders`, {
      method: 'POST',
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

  /**
   * Check if user is VIP
   * Uses userId from localStorage (no auth token required)
   */
  // ===== Weekly Game APIs =====

  async createWeeklyGame(data: {
    prizes: any;
    revealIntervalMin: number;
    resultDate: string;
  }): Promise<WeeklyGame> {
    return this.request<WeeklyGame>('/api/v1/weekly-games', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWeeklyGames(): Promise<WeeklyGame[]> {
    const response = await this.request<{ games: WeeklyGame[] }>('/api/v1/weekly-games');
    return response.games;
  }

  async getWeeklyGame(gameId: string): Promise<WeeklyGame> {
    return this.request<WeeklyGame>(`/api/v1/weekly-games/${gameId}`);
  }

  async joinWeeklyGame(gameId: string, userId?: string, userName?: string): Promise<{
    playerId: string;
    ticket: number[][];
    gameId: string;
  }> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (userName) params.append('userName', userName);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/v1/weekly-games/${gameId}/join${query}`, {
      method: 'POST',
    });
  }

  async getWeeklyPlayerState(gameId: string, userId?: string): Promise<WeeklyPlayerState> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/v1/weekly-games/${gameId}/my-state${query}`);
  }

  async markWeeklyNumber(gameId: string, number: number, userId?: string): Promise<{ success: boolean }> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/v1/weekly-games/${gameId}/mark${query}`, {
      method: 'POST',
      body: JSON.stringify({ number }),
    });
  }

  async claimWeeklyWin(gameId: string, category: string, userId?: string): Promise<{
    success: boolean;
    category: string;
    completedAtCall: number;
    claimedAt: string;
  }> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/v1/weekly-games/${gameId}/claim${query}`, {
      method: 'POST',
      body: JSON.stringify({ category }),
    });
  }

  async getWeeklyResults(gameId: string): Promise<WeeklyResult> {
    return this.request(`/api/v1/weekly-games/${gameId}/results`);
  }

  async updateWeeklyGameStatus(gameId: string, data: { status?: string; prizes?: any }): Promise<any> {
    return this.request(`/api/v1/weekly-games/${gameId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWeeklyGame(gameId: string): Promise<void> {
    await this.request(`/api/v1/weekly-games/${gameId}`, {
      method: 'DELETE',
    });
  }

  async checkVipStatus(): Promise<boolean> {
    const userId = localStorage.getItem('app_user_id');
    if (!userId) {
      return false; // No userId means not VIP
    }
    const response = await fetch(`${API_URL}/api/v1/vip-cohort/check?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.isVIP;
  }

  // ========== Solo Game API ==========

  async getSoloCurrentWeek(): Promise<SoloWeekResponse> {
    return this.request<SoloWeekResponse>(`/api/v1/solo/current-week${this.getSoloQuery()}`);
  }

  private getSoloQuery(): string {
    const userId = localStorage.getItem('app_user_id');
    return userId ? `?userId=${userId}` : '';
  }

  async startSoloGame(gameNumber: number = 1): Promise<StartSoloGameResponse> {
    const query = this.getSoloQuery();
    const gameParam = gameNumber === 2 ? `${query ? '&' : '?'}gameNumber=2` : '';
    return this.request<StartSoloGameResponse>(`/api/v1/solo/start-game${query}${gameParam}`, {
      method: 'POST',
    });
  }

  async claimSoloCategory(data: {
    soloGameId: string;
    category: string;
    currentNumberIndex: number;
  }): Promise<SoloClaimResponse> {
    return this.request<SoloClaimResponse>(`/api/v1/solo/claim${this.getSoloQuery()}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMySoloGame(): Promise<MySoloGameResponse> {
    return this.request<MySoloGameResponse>(`/api/v1/solo/my-game${this.getSoloQuery()}`);
  }

  async getSoloLeaderboard(weekId?: string, gameNumber?: number): Promise<SoloLeaderboardResponse> {
    const params = new URLSearchParams();
    if (weekId) params.set('weekId', weekId);
    if (gameNumber) params.set('gameNumber', String(gameNumber));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<SoloLeaderboardResponse>(`/api/v1/solo/leaderboard${query}`);
  }

  async getSoloCategoryRankings(weekId?: string, gameNumber?: number): Promise<CategoryRankingsResponse> {
    const baseQuery = this.getSoloQuery();
    const weekParam = weekId ? `&weekId=${weekId}` : '';
    const gameParam = gameNumber ? `&gameNumber=${gameNumber}` : '';
    return this.request<CategoryRankingsResponse>(`/api/v1/solo/category-rankings${baseQuery}${weekParam}${gameParam}`);
  }

  async updateSoloProgress(data: {
    soloGameId: string;
    currentIndex: number;
    markedNumbers: number[];
  }): Promise<void> {
    await this.request(`/api/v1/solo/update-progress${this.getSoloQuery()}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async completeSoloGame(data: {
    soloGameId: string;
    markedNumbers: number[];
  }): Promise<void> {
    await this.request(`/api/v1/solo/complete-game${this.getSoloQuery()}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Merge all SoloGame rows owned by an anonymous user into the current
   * (real) user's account. Called by MobileOTPLogin after successful OTP
   * verification when the user came through the 3-stage funnel's LoginWall.
   *
   * The query-string userId is automatically populated by getSoloQuery()
   * from localStorage.app_user_id, which by the time this is called has
   * already been updated to the real tambola userId from the verifyOTP
   * response.
   *
   * Plan: /Users/stageadmin/.claude/plans/merry-hatching-prism.md
   */
  async mergeAnonymousSoloGames(
    anonymousUserId: string
  ): Promise<{ mergedGames: number; droppedGames: number }> {
    return this.request<{ mergedGames: number; droppedGames: number }>(
      `/api/v1/solo/merge-anonymous${this.getSoloQuery()}`,
      {
        method: 'POST',
        body: JSON.stringify({ anonymousUserId }),
      }
    );
  }

  // ========== Solo Week Configuration (Organizer) ==========

  async configureSoloWeek(data: {
    videoUrl: string;
    numberSequence: number[];
    numberTimestamps: number[];
    gameNumber?: number;
  }): Promise<ConfigureSoloWeekResponse> {
    return this.request<ConfigureSoloWeekResponse>('/api/v1/solo/configure-week', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSoloWeekConfig(): Promise<SoloWeekConfigResponse> {
    return this.request<SoloWeekConfigResponse>('/api/v1/solo/week-config');
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
  lastResetAt: string;
  createdAt: string;
}

export interface WeeklyGame {
  id: string;
  status: string;
  prizes: any;
  revealedCount: number;
  revealIntervalMin: number;
  lastRevealedAt: string;
  resultDate: string;
  startedAt: string;
  playerCount: number;
  revealedNumbers?: number[];
  currentNumber?: number;
}

export interface WeeklyPlayerState {
  game: {
    id: string;
    status: string;
    prizes: any;
    revealedCount: number;
    revealIntervalMin: number;
    lastRevealedAt: string;
    resultDate: string;
    startedAt: string;
  };
  player: {
    id: string;
    ticket: number[][];
    markedNumbers: number[];
    missedNumbers: number[];
  };
  revealedNumbers: number[];
  todayNumbers: number[];
  currentNumber: number | null;
  claims: Array<{ category: string; completedAtCall: number; claimedAt: string }>;
  wonCategories: string[];
}

export interface WeeklyResult {
  gameId: string;
  prizes: any;
  results: Array<{
    category: string;
    winnerId: string | null;
    playerName: string | null;
    completedAtCall: number | null;
    claimedAt: string | null;
  }>;
}

// Solo Game Types
export interface SoloWeekResponse {
  week: {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    status: 'ACTIVE' | 'FINALIZED';
    finalizedAt?: string;
    videoUrl?: string;
    videoId?: string;
    isConfigured?: boolean;
    isGame2Configured?: boolean;
  };
  stats: { playerCount: number };
  userStatus: {
    hasPlayed: boolean;
    gameStatus: string | null;
    game2Status: {
      available: boolean;
      cooldownEndsAt: string | null;
      hasPlayed: boolean;
      gameStatus: string | null;
    };
  };
  flags: { isSoloGameDay: boolean; isSunday: boolean };
}

export interface StartSoloGameResponse {
  soloGameId: string;
  weekId: string;
  gameNumber: number;
  ticket: number[][];
  numberSequence: number[];
  status: string;
  videoUrl: string | null;
  videoId: string | null;
  numberTimestamps: number[];
}

export interface SoloClaimResponse {
  claim: {
    id: string;
    category: string;
    numberCountAtClaim: number;
    claimedAt: string;
  };
  gameComplete: boolean;
}

export interface SoloGameData {
  id: string;
  weekId: string;
  gameNumber: number;
  ticket: number[][];
  numberSequence: number[];
  markedNumbers: number[];
  currentIndex: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
  claims: Array<{
    id: string;
    category: string;
    numberCountAtClaim: number;
    claimedAt: string;
  }>;
}

export interface MySoloGameResponse {
  game: SoloGameData | null;
  game1: SoloGameData | null;
  game2: SoloGameData | null;
  game2Status: {
    available: boolean;
    cooldownEndsAt: string | null;
    configured: boolean;
  };
  videoUrl?: string;
  videoId?: string;
  numberTimestamps?: number[];
  game2VideoUrl?: string;
  game2VideoId?: string;
  game2NumberTimestamps?: number[];
  isConfigured?: boolean;
  canPlay: boolean;
  isSunday: boolean;
  currentWeek: {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    status: string;
  };
}

export interface SoloLeaderboardEntry {
  category: string;
  userId: string;
  userName: string | null;
  numberCountAtClaim: number;
  claimedAt: string;
  isFinalized: boolean;
}

export interface SoloLeaderboardResponse {
  week: {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    status: string;
    finalizedAt?: string;
  };
  leaderboard: SoloLeaderboardEntry[];
  playerCount?: number;
}

export interface CategoryRankingEntry {
  rank: number;
  userName: string;
  numberCountAtClaim: number;
  isCurrentUser: boolean;
}

export interface CategoryRankingsResponse {
  rankings: Record<string, CategoryRankingEntry[]>;
  userRanks: Record<string, number | null>;
  totalClaimers: Record<string, number>;
}

export interface ConfigureSoloWeekResponse {
  success: boolean;
  week: {
    id: string;
    videoUrl: string;
    videoId: string;
    numberSequence: number[];
    numberTimestamps: number[];
    configuredAt: string;
  };
}

export interface SoloWeekConfigResponse {
  week: {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    status: string;
    videoUrl: string | null;
    videoId: string | null;
    numberSequence: number[];
    numberTimestamps: number[];
    videoStartTime: number | null;
    numberInterval: number | null;
    configuredAt: string | null;
    configuredBy: string | null;
    // Game 2 config
    game2VideoUrl: string | null;
    game2VideoId: string | null;
    game2NumberSequence: number[];
    game2NumberTimestamps: number[];
    game2VideoStartTime: number | null;
    game2ConfiguredAt: string | null;
    game2ConfiguredBy: string | null;
  };
  gameCount: number;
  game2Count: number;
  isConfigured: boolean;
  isGame2Configured: boolean;
  canReconfigure: boolean;
  canReconfigureGame2: boolean;
}

// Export singleton instance
export const apiService = new ApiService();
