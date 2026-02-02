import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService, type User } from '../services/api.service';
import { wsService } from '../services/websocket.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  updateActivity: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: Date.now(),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.login({ email, password });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            lastActivity: Date.now(),
          });

          // Connect to WebSocket with userId
          wsService.connect(response.user.id);
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
            isLoading: false,
            lastActivity: Date.now(),
          });

          // Connect to WebSocket with userId
          wsService.connect(response.user.id);
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
        localStorage.removeItem('app_user_id');
        set({
          user: null,
          isAuthenticated: false,
          error: null
        });
      },

      setUser: (user: User) => {
        set({
          user,
          isAuthenticated: true,
          lastActivity: Date.now(),
        });
      },

      loadUser: async () => {
        const appUserId = localStorage.getItem('app_user_id');
        const { user, isAuthenticated } = get();

        // If user came from mobile app and already authenticated, skip
        if (appUserId && user && isAuthenticated) {
          set({ isLoading: false });
          // Only connect if not already connected
          if (!wsService.isConnected()) {
            console.log('[AuthStore] Reconnecting WebSocket for mobile app user');
            wsService.connect(appUserId);
          }
          return;
        }

        // If has appUserId but not authenticated yet, set up user
        if (appUserId) {
          set({
            user: {
              id: appUserId,
              email: `user_${appUserId}@app.com`,
              name: `User ${appUserId}`,
            },
            isAuthenticated: true,
            isLoading: false,
            lastActivity: Date.now(),
          });
          // Only connect if not already connected
          if (!wsService.isConnected()) {
            console.log('[AuthStore] Connecting WebSocket for mobile app user');
            wsService.connect(appUserId);
          }
          return;
        }

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
            isLoading: false,
            lastActivity: Date.now(),
          });

          // Connect to WebSocket with userId
          wsService.connect(user.id);
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

      updateActivity: () => set({ lastActivity: Date.now() }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
    }
  )
);
