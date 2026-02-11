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

// Validate userId - reject invalid values
const isValidUserId = (id: string | null): boolean => {
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
};

// Check if mobile app user exists before creating store
const rawAppUserId = typeof window !== 'undefined' ? localStorage.getItem('app_user_id') : null;
// Filter out invalid userId values
const appUserId = isValidUserId(rawAppUserId) ? rawAppUserId : null;
const nowTimestamp = Date.now();

// If mobile app user exists, clear any old auth session to prevent conflicts
if (appUserId && typeof window !== 'undefined') {
  const existingAuth = localStorage.getItem('auth-storage');
  if (existingAuth) {
    const parsed = JSON.parse(existingAuth);
    // If persisted user doesn't match app_user_id, clear it
    if (!parsed.state?.user || parsed.state.user.id !== appUserId) {
      console.log('[AuthStore] Clearing old auth session for mobile app user');
      localStorage.removeItem('auth-storage');
    }
  }
}

// Helper function to check if name is in default format
const isDefaultName = (name: string | null): boolean => {
  if (!name) return true;
  return name.startsWith('User ') || name.startsWith('user_');
};

// Get saved name only if it's not in default format
const getSavedName = (): string | null => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('playerName') : null;
  return saved && !isDefaultName(saved) ? saved : null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: appUserId ? {
        id: appUserId,
        email: `user_${appUserId}@app.com`,
        name: getSavedName() || `User ${appUserId}`,
      } : null,
      isAuthenticated: !!appUserId,
      isLoading: false,
      error: null,
      lastActivity: nowTimestamp,

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
        // DON'T remove app_user_id - mobile app controls this
        // Only clear for regular users (those with JWT tokens)
        sessionStorage.removeItem('playerName'); // Clear player name on logout
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
        const rawAppUserId = localStorage.getItem('app_user_id');
        // Filter out invalid userId values
        const appUserId = isValidUserId(rawAppUserId) ? rawAppUserId : null;
        const { user } = get();

        // If app_user_id exists, always prioritize mobile app user
        if (appUserId) {
          // Clear any JWT token (mobile app users don't use JWT)
          apiService.clearToken();

          // If existing user doesn't match app_user_id, clear and set up mobile user
          if (!user || user.id !== appUserId) {
            console.log('[AuthStore] Setting up mobile app user:', appUserId);
            const freshTimestamp = Date.now();
            const savedName = getSavedName();
            set({
              user: {
                id: appUserId,
                email: `user_${appUserId}@app.com`,
                name: savedName || `User ${appUserId}`,
              },
              isAuthenticated: true,
              isLoading: false,
              lastActivity: freshTimestamp,
            });
            // Only connect if not already connected
            if (!wsService.isConnected()) {
              console.log('[AuthStore] Connecting WebSocket for mobile app user');
              wsService.connect(appUserId);
            }
          } else {
            // Already set up correctly, but refresh activity timestamp
            set({ isLoading: false, lastActivity: Date.now() });
            if (!wsService.isConnected()) {
              console.log('[AuthStore] Reconnecting WebSocket for mobile app user');
              wsService.connect(appUserId);
            }
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
      // Custom merge to handle mobile app user priority
      merge: (persistedState: any, currentState: any) => {
        const rawAppUserId = typeof window !== 'undefined' ? localStorage.getItem('app_user_id') : null;
        // Filter out invalid userId values
        const currentAppUserId = isValidUserId(rawAppUserId) ? rawAppUserId : null;

        // If app_user_id exists, use mobile app user
        if (currentAppUserId) {
          console.log('[AuthStore] Mobile app user detected');

          // Check if persisted state has a valid user with custom name
          const persistedUser = persistedState?.user;
          const persistedName = persistedUser?.name;
          const hasValidPersistedName = persistedName && !isDefaultName(persistedName);

          console.log('[AuthStore] Persisted user name:', persistedName);
          console.log('[AuthStore] Has valid persisted name:', hasValidPersistedName);

          // Priority: persisted user name > localStorage playerName > default
          const finalName = hasValidPersistedName
            ? persistedName
            : (getSavedName() || `User ${currentAppUserId}`);

          console.log('[AuthStore] Final name:', finalName);

          return {
            ...currentState,
            user: {
              id: currentAppUserId,
              email: `user_${currentAppUserId}@app.com`,
              name: finalName,
            },
            isAuthenticated: true,
            lastActivity: Date.now(),
          };
        }

        // No app_user_id, use persisted state normally
        return { ...currentState, ...persistedState };
      },
    }
  )
);
