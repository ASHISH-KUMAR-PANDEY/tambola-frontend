const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  email: string;
  name: string;
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
      'Content-Type': 'application/json',
      ...options.headers,
    };

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
    return this.request<User>('/api/v1/auth/me');
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
}

// Export singleton instance
export const apiService = new ApiService();
