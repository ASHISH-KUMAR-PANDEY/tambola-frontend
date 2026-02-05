import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export interface GameJoinedPayload {
  gameId: string;
  playerId: string;
  ticket: number[][];
}

export interface PlayerJoinedPayload {
  playerId: string;
  userName: string;
}

export interface NumberCalledPayload {
  number: number;
}

export interface WinnerPayload {
  playerId: string;
  userName?: string;
  category: 'EARLY_5' | 'TOP_LINE' | 'MIDDLE_LINE' | 'BOTTOM_LINE' | 'FULL_HOUSE';
}

export interface WinClaimedPayload {
  category: string;
  success: boolean;
  message: string;
}

export interface GameCompletedPayload {
  gameId: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface StateSyncPayload {
  calledNumbers: number[];
  currentNumber?: number;
  players: Array<{ playerId: string; userName: string }>;
  winners: Array<{ playerId: string; category: string; userName?: string }>;
  markedNumbers?: number[];
}

export interface GameDeletedPayload {
  gameId: string;
  message: string;
}

export type GameEventHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onGameJoined?: (data: GameJoinedPayload) => void;
  onStateSync?: (data: StateSyncPayload) => void;
  onPlayerJoined?: (data: PlayerJoinedPayload) => void;
  onGameStarted?: (data: { gameId: string }) => void;
  onNumberCalled?: (data: NumberCalledPayload) => void;
  onWinner?: (data: WinnerPayload) => void;
  onWinClaimed?: (data: WinClaimedPayload) => void;
  onGameCompleted?: (data: GameCompletedPayload) => void;
  onGameDeleted?: (data: GameDeletedPayload) => void;
  onError?: (data: ErrorPayload) => void;
};

class WebSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private handlers: GameEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Connect to WebSocket server with userId authentication
   */
  connect(userId: string): void {
    // If already connected with the same userId, skip
    if (this.socket?.connected && this.userId === userId) {
      console.log('[WebSocket] Already connected with userId:', userId);
      return;
    }

    // If connecting with different userId, disconnect first
    if (this.socket && this.userId !== userId) {
      console.log('[WebSocket] Switching userId, disconnecting first');
      this.disconnect();
    }

    console.log('[WebSocket] Initiating connection for userId:', userId);
    this.userId = userId;

    this.socket = io(WS_URL, {
      auth: { userId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
    console.log('[WebSocket] Socket instance created, waiting for connection...');
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.userId = null;
    this.handlers = {};
    this.reconnectAttempts = 0;
  }

  /**
   * Register event handlers
   */
  on(handlers: GameEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Remove event handlers
   */
  off(): void {
    this.handlers = {};
  }

  /**
   * Join a game
   */
  joinGame(gameId: string, playerName?: string): void {
    if (!this.socket) {
      console.error('[WebSocket] Socket not initialized. Cannot join game.');
      return;
    }
    if (!this.socket.connected) {
      console.error('[WebSocket] Socket not connected. Status:', {
        connected: this.socket.connected,
        disconnected: this.socket.disconnected,
        userId: this.userId,
      });
      return;
    }
    console.log('[WebSocket] ===== EMIT game:join =====');
    console.log('[WebSocket] gameId:', gameId);
    console.log('[WebSocket] playerName param:', playerName);
    console.log('[WebSocket] playerName type:', typeof playerName);
    console.log('[WebSocket] playerName length:', playerName?.length);
    console.log('[WebSocket] Payload:', JSON.stringify({ gameId, userName: playerName }));
    this.socket.emit('game:join', { gameId, userName: playerName });
    console.log('[WebSocket] ✓ Event emitted');
  }

  /**
   * Leave a game
   */
  leaveGame(gameId: string): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }
    this.socket.emit('game:leave', { gameId });
  }

  /**
   * Start a game (organizer only)
   */
  startGame(gameId: string): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }
    this.socket.emit('game:start', { gameId });
  }

  /**
   * Call a specific number (organizer only)
   */
  callNumber(gameId: string, number: number): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }
    this.socket.emit('game:callNumber', { gameId, number });
  }

  /**
   * Mark a number manually (player only)
   */
  markNumber(gameId: string, playerId: string, number: number): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }
    this.socket.emit('game:markNumber', { gameId, playerId, number });
  }

  /**
   * Claim a win (player only)
   */
  claimWin(gameId: string, category: string): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }
    this.socket.emit('game:claimWin', { gameId, category });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected successfully! Socket ID:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.handlers.onConnected?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected. Reason:', reason);
      this.handlers.onDisconnected?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.handlers.onError?.({
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to game server. Please check your connection.',
        });
      }
    });

    // Game event listeners
    this.socket.on('game:joined', (data: GameJoinedPayload) => {
      console.log('Game joined:', data);
      this.handlers.onGameJoined?.(data);
    });

    this.socket.on('game:stateSync', (data: StateSyncPayload) => {
      console.log('Game state sync:', data);
      this.handlers.onStateSync?.(data);
    });

    this.socket.on('game:playerJoined', (data: PlayerJoinedPayload) => {
      console.log('Player joined:', data);
      this.handlers.onPlayerJoined?.(data);
    });

    this.socket.on('game:started', (data: { gameId: string }) => {
      console.log('Game started:', data);
      this.handlers.onGameStarted?.(data);
    });

    this.socket.on('game:numberCalled', (data: NumberCalledPayload) => {
      console.log('Number called:', data);
      this.handlers.onNumberCalled?.(data);
    });

    this.socket.on('game:winner', (data: WinnerPayload) => {
      console.log('Winner:', data);
      this.handlers.onWinner?.(data);
    });

    this.socket.on('game:winClaimed', (data: WinClaimedPayload) => {
      console.log('Win claimed:', data);
      this.handlers.onWinClaimed?.(data);
    });

    this.socket.on('game:completed', (data: GameCompletedPayload) => {
      console.log('Game completed:', data);
      this.handlers.onGameCompleted?.(data);
    });

    this.socket.on('game:deleted', (data: GameDeletedPayload) => {
      console.log('Game deleted:', data);
      this.handlers.onGameDeleted?.(data);
    });

    this.socket.on('error', (data: ErrorPayload) => {
      console.error('Game error:', data);
      this.handlers.onError?.(data);
    });
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
