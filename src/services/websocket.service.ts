import { io, Socket } from 'socket.io-client';
import { frontendLogger } from '../utils/logger';

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
  playerId?: string;  // Added by backend so frontend can add winner even if store playerId is null
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
  playerCount?: number; // Optimized: send count instead of full list for players
  winners: Array<{ playerId: string; category: string; userName?: string }>;
  markedNumbers?: number[];
}

export interface GameDeletedPayload {
  gameId: string;
  message: string;
}

export interface LobbyJoinedPayload {
  gameId: string;
  playerCount: number;
  players: Array<{ userId: string; userName: string }>;
}

export interface LobbyPlayerJoinedPayload {
  gameId: string;
  userId: string;
  userName: string;
  playerCount: number;
  players: Array<{ userId: string; userName: string }>;
}

export interface LobbyPlayerLeftPayload {
  gameId: string;
  userId: string;
  playerCount: number;
  players: Array<{ userId: string; userName: string }>;
}

export interface GameStartingPayload {
  gameId: string;
}

export type GameEventHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onLobbyJoined?: (data: LobbyJoinedPayload) => void;
  onLobbyPlayerJoined?: (data: LobbyPlayerJoinedPayload) => void;
  onLobbyPlayerLeft?: (data: LobbyPlayerLeftPayload) => void;
  onGameStarting?: (data: GameStartingPayload) => void;
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
  private maxReconnectAttempts = 20; // Increased from 5 for mobile network instability

  /**
   * Connect to WebSocket server with userId authentication
   */
  connect(userId: string): void {
    // If already connected with the same userId, skip
    if (this.socket?.connected && this.userId === userId) {
      frontendLogger.websocketEvent('ALREADY_CONNECTED', { userId });
      return;
    }

    // If connecting with different userId, disconnect first
    if (this.socket && this.userId !== userId) {
      frontendLogger.websocketEvent('SWITCHING_USER', { oldUserId: this.userId, newUserId: userId });
      this.disconnect();
    }

    frontendLogger.websocketConnecting(WS_URL);
    frontendLogger.websocketEvent('CONNECT_INITIATED', { userId, url: WS_URL });
    this.userId = userId;

    this.socket = io(WS_URL, {
      auth: { userId },
      reconnection: true,
      reconnectionDelay: 500,           // Start reconnecting faster (was 1000ms)
      reconnectionDelayMax: 3000,       // Cap at 3s (was 5000ms)
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling for compatibility
      upgrade: true,                     // Allow upgrade from polling to WebSocket
      pingTimeout: 20000,                // Wait 20s for pong (was 5s default) - mobile-friendly
      pingInterval: 15000,               // Send ping every 15s (was 25s default)
      timeout: 10000,                    // Connection timeout 10s (was 20s default)
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      frontendLogger.websocketEvent('DISCONNECT_INITIATED', {
        userId: this.userId,
        socketId: this.socket.id,
        wasConnected: this.socket.connected
      });

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
      frontendLogger.error('WEBSOCKET_JOIN_GAME', new Error('Socket not initialized'), {
        gameId,
        playerName,
        userId: this.userId
      });
      return;
    }
    if (!this.socket.connected) {
      frontendLogger.error('WEBSOCKET_JOIN_GAME', new Error('Socket not connected'), {
        gameId,
        playerName,
        userId: this.userId,
        connected: this.socket.connected,
        disconnected: this.socket.disconnected
      });
      return;
    }

    frontendLogger.websocketEvent('game:join', {
      gameId,
      playerName,
      userId: this.userId,
      socketId: this.socket.id
    });

    this.socket.emit('game:join', { gameId, userName: playerName });
  }

  /**
   * Leave a game
   */
  leaveGame(gameId: string): void {
    if (!this.socket?.connected) {
      frontendLogger.error('WEBSOCKET_LEAVE_GAME', new Error('WebSocket not connected'), {
        gameId,
        userId: this.userId
      });
      return;
    }

    frontendLogger.websocketEvent('game:leave', { gameId, userId: this.userId, socketId: this.socket.id });
    this.socket.emit('game:leave', { gameId });
  }

  /**
   * Join waiting lobby
   */
  joinLobby(gameId: string, userName: string): void {
    if (!this.socket) {
      frontendLogger.error('WEBSOCKET_JOIN_LOBBY', new Error('Socket not initialized'), {
        gameId,
        userName,
        userId: this.userId
      });
      return;
    }
    if (!this.socket.connected) {
      frontendLogger.error('WEBSOCKET_JOIN_LOBBY', new Error('Socket not connected'), {
        gameId,
        userName,
        userId: this.userId
      });
      return;
    }

    frontendLogger.websocketEvent('lobby:join', {
      gameId,
      userName,
      userId: this.userId,
      socketId: this.socket.id
    });

    this.socket.emit('lobby:join', { gameId, userName });
  }

  /**
   * Leave waiting lobby
   */
  leaveLobby(gameId: string): void {
    if (!this.socket?.connected) {
      frontendLogger.error('WEBSOCKET_LEAVE_LOBBY', new Error('WebSocket not connected'), {
        gameId,
        userId: this.userId
      });
      return;
    }

    frontendLogger.websocketEvent('lobby:leave', { gameId, userId: this.userId, socketId: this.socket.id });
    this.socket.emit('lobby:leave', { gameId });
  }

  /**
   * Start a game (organizer only)
   */
  startGame(gameId: string): void {
    if (!this.socket?.connected) {
      frontendLogger.error('WEBSOCKET_START_GAME', new Error('WebSocket not connected'), {
        gameId,
        userId: this.userId
      });
      return;
    }

    frontendLogger.websocketEvent('game:start', { gameId, userId: this.userId, socketId: this.socket.id });
    this.socket.emit('game:start', { gameId });
  }

  /**
   * Call a specific number (organizer only)
   * Returns a Promise that resolves when backend confirms or rejects after timeout
   */
  callNumber(gameId: string, number: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        const error = new Error('WebSocket not connected');
        frontendLogger.error('WEBSOCKET_CALL_NUMBER', error, { gameId, number, userId: this.userId });
        reject(error);
        return;
      }

      const startTime = Date.now();
      frontendLogger.websocketEvent('game:callNumber', {
        gameId,
        number,
        userId: this.userId,
        socketId: this.socket.id
      });

      const timeout = setTimeout(() => {
        const duration = Date.now() - startTime;
        const error = new Error('Timeout waiting for confirmation');
        frontendLogger.error('WEBSOCKET_CALL_NUMBER_TIMEOUT', error, {
          gameId,
          number,
          duration_ms: duration
        });
        reject(error);
      }, 5000); // 5 second timeout

      // Emit with acknowledgment callback
      this.socket.emit(
        'game:callNumber',
        { gameId, number },
        (response: { success: boolean; error?: string }) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;

          if (response && response.success) {
            frontendLogger.performance('callNumber', duration, { gameId, number, success: true });
            resolve();
          } else {
            const errorMsg = response?.error || 'Failed to call number';
            frontendLogger.error('WEBSOCKET_CALL_NUMBER_FAILED', new Error(errorMsg), {
              gameId,
              number,
              duration_ms: duration
            });
            reject(new Error(errorMsg));
          }
        }
      );
    });
  }

  /**
   * Mark a number manually (player only)
   */
  markNumber(gameId: string, playerId: string, number: number): void {
    if (!this.socket?.connected) {
      frontendLogger.error('WEBSOCKET_MARK_NUMBER', new Error('WebSocket not connected'), {
        gameId,
        playerId,
        number,
        userId: this.userId
      });
      return;
    }

    frontendLogger.websocketEvent('game:markNumber', {
      gameId,
      playerId,
      number,
      userId: this.userId,
      socketId: this.socket.id
    });

    this.socket.emit('game:markNumber', { gameId, playerId, number });
  }

  /**
   * Claim a win (player only)
   */
  claimWin(gameId: string, category: string): void {
    if (!this.socket?.connected) {
      frontendLogger.error('WEBSOCKET_CLAIM_WIN', new Error('WebSocket not connected'), {
        gameId,
        category,
        userId: this.userId
      });
      return;
    }

    frontendLogger.websocketEvent('game:claimWin', {
      gameId,
      category,
      userId: this.userId,
      socketId: this.socket.id
    });

    this.socket.emit('game:claimWin', { gameId, category });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID (for logging)
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get WebSocket URL (for logging)
   */
  getUrl(): string {
    return WS_URL;
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      const socketId = this.socket?.id || 'unknown';
      frontendLogger.websocketConnected(socketId);
      frontendLogger.websocketEvent('CONNECT_SUCCESS', {
        socketId,
        userId: this.userId,
        reconnectAttempts: this.reconnectAttempts
      });

      this.reconnectAttempts = 0;
      this.handlers.onConnected?.();
    });

    this.socket.on('disconnect', (reason) => {
      frontendLogger.websocketDisconnected(reason);
      frontendLogger.websocketEvent('DISCONNECT', {
        reason,
        socketId: this.socket?.id,
        userId: this.userId
      });

      this.handlers.onDisconnected?.();
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;

      frontendLogger.websocketError(error);
      frontendLogger.measureReconnects(this.reconnectAttempts, error.message);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        frontendLogger.criticalError(error, {
          context: 'Max WebSocket reconnection attempts reached',
          userId: this.userId,
          reconnectAttempts: this.reconnectAttempts
        });

        this.handlers.onError?.({
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to game server. Please check your connection.',
        });
      }
    });

    // Lobby event listeners
    this.socket.on('lobby:joined', (data: LobbyJoinedPayload) => {
      frontendLogger.websocketEvent('lobby:joined (received)', {
        gameId: data.gameId,
        playerCount: data.playerCount,
        userId: this.userId
      });
      this.handlers.onLobbyJoined?.(data);
    });

    this.socket.on('lobby:playerJoined', (data: LobbyPlayerJoinedPayload) => {
      frontendLogger.websocketEvent('lobby:playerJoined (received)', {
        gameId: data.gameId,
        userName: data.userName,
        playerCount: data.playerCount,
        userId: this.userId
      });
      this.handlers.onLobbyPlayerJoined?.(data);
    });

    this.socket.on('lobby:playerLeft', (data: LobbyPlayerLeftPayload) => {
      frontendLogger.websocketEvent('lobby:playerLeft (received)', {
        gameId: data.gameId,
        userId: data.userId,
        playerCount: data.playerCount
      });
      this.handlers.onLobbyPlayerLeft?.(data);
    });

    this.socket.on('game:starting', (data: GameStartingPayload) => {
      frontendLogger.websocketEvent('game:starting (received)', {
        gameId: data.gameId,
        userId: this.userId
      });
      this.handlers.onGameStarting?.(data);
    });

    // Game event listeners
    this.socket.on('game:joined', (data: GameJoinedPayload) => {
      frontendLogger.websocketEvent('game:joined (received)', {
        gameId: data.gameId,
        playerId: data.playerId,
        userId: this.userId
      });
      this.handlers.onGameJoined?.(data);
    });

    this.socket.on('game:stateSync', (data: StateSyncPayload) => {
      frontendLogger.websocketEvent('game:stateSync (received)', {
        calledNumbers: data.calledNumbers.length,
        currentNumber: data.currentNumber,
        playersCount: data.playerCount || data.players.length,
        winnersCount: data.winners.length,
        userId: this.userId
      });
      this.handlers.onStateSync?.(data);
    });

    this.socket.on('game:playerJoined', (data: PlayerJoinedPayload) => {
      frontendLogger.websocketEvent('game:playerJoined (received)', {
        playerId: data.playerId,
        userName: data.userName,
        userId: this.userId
      });
      this.handlers.onPlayerJoined?.(data);
    });

    this.socket.on('game:started', (data: { gameId: string }) => {
      frontendLogger.websocketEvent('game:started (received)', {
        gameId: data.gameId,
        userId: this.userId
      });
      this.handlers.onGameStarted?.(data);
    });

    this.socket.on('game:numberCalled', (data: NumberCalledPayload) => {
      frontendLogger.websocketEvent('game:numberCalled (received)', {
        number: data.number,
        userId: this.userId
      });
      this.handlers.onNumberCalled?.(data);
    });

    this.socket.on('game:winner', (data: WinnerPayload) => {
      frontendLogger.websocketEvent('game:winner (received)', {
        playerId: data.playerId,
        category: data.category,
        userName: data.userName,
        userId: this.userId
      });
      this.handlers.onWinner?.(data);
    });

    this.socket.on('game:winClaimed', (data: WinClaimedPayload, ack?: () => void) => {
      frontendLogger.websocketEvent('game:winClaimed (received)', {
        category: data.category,
        success: data.success,
        message: data.message,
        userId: this.userId
      });

      // Process the event
      this.handlers.onWinClaimed?.(data);

      // Acknowledge receipt to ensure reliable delivery
      if (ack) {
        ack();
        frontendLogger.info('Acknowledged game:winClaimed event', { category: data.category });
      }
    });

    this.socket.on('game:completed', (data: GameCompletedPayload) => {
      frontendLogger.websocketEvent('game:completed (received)', {
        gameId: data.gameId,
        userId: this.userId
      });
      this.handlers.onGameCompleted?.(data);
    });

    this.socket.on('game:deleted', (data: GameDeletedPayload) => {
      frontendLogger.websocketEvent('game:deleted (received)', {
        gameId: data.gameId,
        message: data.message,
        userId: this.userId
      });
      this.handlers.onGameDeleted?.(data);
    });

    this.socket.on('error', (data: ErrorPayload) => {
      frontendLogger.websocketEvent('error (received)', {
        code: data.code,
        message: data.message,
        userId: this.userId
      });
      frontendLogger.error('WEBSOCKET_GAME_ERROR', new Error(data.message), {
        code: data.code,
        userId: this.userId
      });
      this.handlers.onError?.(data);
    });
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
