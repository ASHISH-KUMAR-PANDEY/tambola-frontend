const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
    const headers: HeadersInit = {
      ...options.headers,
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
    const query = status ? `?status=${status}` : '';
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
    const response = await this.request<{ games: Game[] }>('/api/v1/games/my-active');
    return response.games;
  }

  /**
   * Upload promotional banner
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
}

export interface PromotionalBanner {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

// Export singleton instance
export const apiService = new ApiService();
