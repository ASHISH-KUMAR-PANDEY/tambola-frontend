/**
 * Frontend Logging System with On/Off Controls
 *
 * Control logging via localStorage:
 * - localStorage.setItem('tambola_logs', 'true/false') - Enable/disable all logs
 * - localStorage.setItem('tambola_logs_organizer', 'true/false') - Organizer actions
 * - localStorage.setItem('tambola_logs_player', 'true/false') - Player actions
 * - localStorage.setItem('tambola_logs_performance', 'true/false') - Performance metrics
 * - localStorage.setItem('tambola_logs_websocket', 'true/false') - WebSocket events
 * - localStorage.setItem('tambola_logs_errors', 'true/false') - Errors (always on by default)
 */

interface LogConfig {
  enabled: boolean;
  organizer: boolean;
  player: boolean;
  performance: boolean;
  websocket: boolean;
  errors: boolean;
  userInteractions: boolean;
  networkQuality: boolean;
}

class FrontendLogger {
  private config: LogConfig;
  private performanceMarks: Map<string, number> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.printConfig();
  }

  private loadConfig(): LogConfig {
    const getItem = (key: string, defaultValue: boolean): boolean => {
      const value = localStorage.getItem(`tambola_logs_${key}`);
      if (value === null) return defaultValue;
      return value === 'true' || value === '1';
    };

    const masterSwitch = localStorage.getItem('tambola_logs');
    const masterEnabled = masterSwitch === null ? true : (masterSwitch === 'true' || masterSwitch === '1');

    return {
      enabled: masterEnabled,
      organizer: getItem('organizer', true),
      player: getItem('player', true),
      performance: getItem('performance', true),
      websocket: getItem('websocket', true),
      errors: getItem('errors', true), // Always on by default
      userInteractions: getItem('interactions', false), // Can be verbose
      networkQuality: getItem('network', false), // Can be verbose
    };
  }

  private printConfig() {
    if (!this.config.enabled) {
      console.log('%c[Tambola Logs] Disabled', 'color: #999; font-weight: bold');
      return;
    }

    console.log('%c========== Tambola Logging Config ==========', 'color: #4CAF50; font-weight: bold');
    console.log(`%cOrganizer Actions: ${this.config.organizer ? '✓ ON' : '✗ OFF'}`, this.config.organizer ? 'color: #4CAF50' : 'color: #999');
    console.log(`%cPlayer Actions:    ${this.config.player ? '✓ ON' : '✗ OFF'}`, this.config.player ? 'color: #4CAF50' : 'color: #999');
    console.log(`%cPerformance:       ${this.config.performance ? '✓ ON' : '✗ OFF'}`, this.config.performance ? 'color: #4CAF50' : 'color: #999');
    console.log(`%cWebSocket:         ${this.config.websocket ? '✓ ON' : '✗ OFF'}`, this.config.websocket ? 'color: #4CAF50' : 'color: #999');
    console.log(`%cErrors:            ${this.config.errors ? '✓ ON' : '✗ OFF'}`, this.config.errors ? 'color: #4CAF50' : 'color: #999');
    console.log(`%cUser Interactions: ${this.config.userInteractions ? '✓ ON' : '✗ OFF'}`, this.config.userInteractions ? 'color: #4CAF50' : 'color: #999');
    console.log(`%cNetwork Quality:   ${this.config.networkQuality ? '✓ ON' : '✗ OFF'}`, this.config.networkQuality ? 'color: #4CAF50' : 'color: #999');
    console.log('%c===========================================', 'color: #4CAF50; font-weight: bold');
    console.log('%cTo change: localStorage.setItem("tambola_logs_organizer", "true/false")', 'color: #666; font-style: italic');
    console.log('%cTo disable all: localStorage.setItem("tambola_logs", "false")', 'color: #666; font-style: italic');
  }

  // ========== ORGANIZER ACTIONS ==========

  organizerAction(action: string, data: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.organizer) return;

    console.log(
      `%c[ORGANIZER] %c${action}`,
      'color: #FF9800; font-weight: bold',
      'color: #333',
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  organizerLoadStart() {
    this.organizerAction('LOAD_START', {});
    this.markStart('organizer_load');
  }

  organizerLoadComplete(gameData: any) {
    const duration = this.markEnd('organizer_load');
    this.organizerAction('LOAD_COMPLETE', {
      duration_ms: duration,
      playerCount: gameData?.players?.length || 0,
      numbersCalledCount: gameData?.calledNumbers?.length || 0,
    });
  }

  organizerCallNumber(gameId: string, number: number) {
    this.organizerAction('CALL_NUMBER', { gameId, number });
    this.markStart(`call_number_${number}`);
  }

  organizerCallNumberSuccess(number: number) {
    const duration = this.markEnd(`call_number_${number}`);
    this.organizerAction('CALL_NUMBER_SUCCESS', { number, duration_ms: duration });
  }

  organizerCallNumberError(number: number, error: string) {
    const duration = this.markEnd(`call_number_${number}`);
    this.organizerAction('CALL_NUMBER_ERROR', { number, error, duration_ms: duration });
  }

  organizerStartGame(gameId: string) {
    this.organizerAction('START_GAME', { gameId });
  }

  organizerDeleteGame(gameId: string) {
    this.organizerAction('DELETE_GAME', { gameId });
  }

  // ========== PLAYER ACTIONS ==========

  playerAction(action: string, data: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.player) return;

    console.log(
      `%c[PLAYER] %c${action}`,
      'color: #2196F3; font-weight: bold',
      'color: #333',
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  playerJoinGame(gameId: string) {
    this.playerAction('JOIN_GAME', { gameId });
    this.markStart('player_join');
  }

  playerJoinedSuccess(gameId: string, playerId: string) {
    const duration = this.markEnd('player_join');
    this.playerAction('JOINED_SUCCESS', { gameId, playerId, duration_ms: duration });
  }

  playerMarkNumber(gameId: string, number: number, totalMarked: number) {
    this.playerAction('MARK_NUMBER', { gameId, number, totalMarked });
  }

  playerUnmarkNumber(gameId: string, number: number, totalMarked: number) {
    this.playerAction('UNMARK_NUMBER', { gameId, number, totalMarked });
  }

  playerClaimWin(gameId: string, category: string) {
    this.playerAction('CLAIM_WIN', { gameId, category });
    this.markStart(`claim_win_${category}`);
  }

  playerWinClaimResult(category: string, success: boolean, message: string) {
    const duration = this.markEnd(`claim_win_${category}`);
    this.playerAction('WIN_CLAIM_RESULT', { category, success, message, duration_ms: duration });
  }

  playerLeaveGame(gameId: string) {
    this.playerAction('LEAVE_GAME', { gameId });
  }

  // ========== USER INTERACTIONS ==========

  userInteraction(action: string, data: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.userInteractions) return;

    console.log(
      `%c[INTERACTION] %c${action}`,
      'color: #9C27B0; font-weight: bold',
      'color: #333',
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  buttonClick(buttonName: string, context?: Record<string, any>) {
    this.userInteraction('BUTTON_CLICK', { buttonName, ...context });
  }

  inputChange(inputName: string, value: any) {
    this.userInteraction('INPUT_CHANGE', { inputName, value });
  }

  modalOpen(modalName: string) {
    this.userInteraction('MODAL_OPEN', { modalName });
  }

  modalClose(modalName: string) {
    this.userInteraction('MODAL_CLOSE', { modalName });
  }

  // ========== WEBSOCKET ==========

  websocket(action: string, data: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.websocket) return;

    console.log(
      `%c[WS] %c${action}`,
      'color: #00BCD4; font-weight: bold',
      'color: #333',
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  websocketConnecting(url: string) {
    this.websocket('CONNECTING', { url });
    this.markStart('ws_connect');
  }

  websocketConnected(socketId: string) {
    const duration = this.markEnd('ws_connect');
    this.websocket('CONNECTED', { socketId, duration_ms: duration });
  }

  websocketDisconnected(reason: string) {
    this.websocket('DISCONNECTED', { reason });
  }

  websocketError(error: string) {
    this.websocket('ERROR', { error });
  }

  websocketReconnecting(attempt: number) {
    this.websocket('RECONNECTING', { attempt });
  }

  websocketEvent(eventName: string, data?: any) {
    this.websocket(`EVENT_${eventName}`, data);
  }

  // ========== PERFORMANCE ==========

  performance(operation: string, duration_ms: number, data: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.performance) return;

    const color = duration_ms < 100 ? '#4CAF50' : duration_ms < 500 ? '#FF9800' : '#F44336';

    console.log(
      `%c[PERF] %c${operation} %c${duration_ms}ms`,
      'color: #673AB7; font-weight: bold',
      'color: #333',
      `color: ${color}; font-weight: bold`,
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  markStart(label: string) {
    this.performanceMarks.set(label, Date.now());
  }

  markEnd(label: string): number {
    const startTime = this.performanceMarks.get(label);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.performanceMarks.delete(label);
    return duration;
  }

  apiCall(endpoint: string, method: string, duration_ms: number, status: number) {
    this.performance('API_CALL', duration_ms, { endpoint, method, status });
  }

  componentRender(componentName: string, duration_ms: number) {
    this.performance('RENDER', duration_ms, { componentName });
  }

  // ========== NETWORK QUALITY ==========

  networkQuality(metrics: Record<string, any>) {
    if (!this.config.enabled || !this.config.networkQuality) return;

    console.log(
      '%c[NETWORK]',
      'color: #607D8B; font-weight: bold',
      {
        timestamp: new Date().toISOString(),
        ...metrics,
      }
    );
  }

  measureLatency(ping_ms: number) {
    this.networkQuality({ type: 'LATENCY', ping_ms });
  }

  measureReconnects(count: number, reason: string) {
    this.networkQuality({ type: 'RECONNECTS', count, reason });
  }

  // ========== ERRORS ==========

  error(category: string, error: Error | string, context: Record<string, any> = {}) {
    if (!this.config.enabled || !this.config.errors) return;

    console.error(
      `%c[ERROR] %c${category}`,
      'color: #F44336; font-weight: bold',
      'color: #333',
      {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      }
    );
  }

  criticalError(error: Error | string, context: Record<string, any> = {}) {
    // Critical errors are always logged
    console.error(
      '%c[CRITICAL ERROR]',
      'color: #F44336; font-weight: bold; font-size: 16px; background: #FFEBEE; padding: 4px 8px',
      {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      }
    );
  }

  // ========== GENERAL ==========

  info(message: string, data: Record<string, any> = {}) {
    if (!this.config.enabled) return;

    console.log(
      '%c[INFO]',
      'color: #4CAF50; font-weight: bold',
      message,
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  warn(message: string, data: Record<string, any> = {}) {
    if (!this.config.enabled) return;

    console.warn(
      '%c[WARN]',
      'color: #FF9800; font-weight: bold',
      message,
      {
        timestamp: new Date().toISOString(),
        ...data,
      }
    );
  }

  // ========== HELPERS ==========

  enableAll() {
    localStorage.setItem('tambola_logs', 'true');
    localStorage.setItem('tambola_logs_organizer', 'true');
    localStorage.setItem('tambola_logs_player', 'true');
    localStorage.setItem('tambola_logs_performance', 'true');
    localStorage.setItem('tambola_logs_websocket', 'true');
    localStorage.setItem('tambola_logs_errors', 'true');
    localStorage.setItem('tambola_logs_interactions', 'true');
    localStorage.setItem('tambola_logs_network', 'true');
    console.log('%c✓ All logging enabled. Refresh page to apply.', 'color: #4CAF50; font-weight: bold');
  }

  disableAll() {
    localStorage.setItem('tambola_logs', 'false');
    console.log('%c✗ All logging disabled. Refresh page to apply.', 'color: #999; font-weight: bold');
  }

  reset() {
    localStorage.removeItem('tambola_logs');
    localStorage.removeItem('tambola_logs_organizer');
    localStorage.removeItem('tambola_logs_player');
    localStorage.removeItem('tambola_logs_performance');
    localStorage.removeItem('tambola_logs_websocket');
    localStorage.removeItem('tambola_logs_errors');
    localStorage.removeItem('tambola_logs_interactions');
    localStorage.removeItem('tambola_logs_network');
    console.log('%c↻ Logging config reset to defaults. Refresh page to apply.', 'color: #2196F3; font-weight: bold');
  }
}

// Export singleton instance
export const frontendLogger = new FrontendLogger();

// Make available in browser console for easy control
if (typeof window !== 'undefined') {
  (window as any).tambolaLogger = {
    enableAll: () => frontendLogger.enableAll(),
    disableAll: () => frontendLogger.disableAll(),
    reset: () => frontendLogger.reset(),
  };

  console.log('%cTambola Logger Controls:', 'color: #4CAF50; font-weight: bold; font-size: 14px');
  console.log('%cwindow.tambolaLogger.enableAll()  - Enable all logs', 'color: #666');
  console.log('%cwindow.tambolaLogger.disableAll() - Disable all logs', 'color: #666');
  console.log('%cwindow.tambolaLogger.reset()      - Reset to defaults', 'color: #666');
}
