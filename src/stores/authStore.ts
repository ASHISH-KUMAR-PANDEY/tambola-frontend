import { create } from 'zustand';
import { apiService, type User } from '../services/api.service';
import { wsService } from '../services/websocket.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.login({ email, password });
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });

      // Connect to WebSocket with token
      wsService.connect(response.token);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      });
      throw error;
    }
  },

  signup: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.signup({ email, password, name });
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });

      // Connect to WebSocket with token
      wsService.connect(response.token);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Signup failed',
        isLoading: false
      });
      throw error;
    }
  },

  logout: () => {
    apiService.logout();
    wsService.disconnect();
    set({
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  loadUser: async () => {
    const token = apiService.getToken();
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await apiService.getCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false
      });

      // Connect to WebSocket with existing token
      wsService.connect(token);
    } catch (error) {
      apiService.clearToken();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  clearError: () => set({ error: null }),
}));
