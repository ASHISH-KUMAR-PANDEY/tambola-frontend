import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.tambolagame.com';

// Send debug logs to backend
const logToBackend = (event: string, data: any = {}) => {
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    windowKeys: {
      Flutter: typeof (window as any).Flutter,
      FlutterChannel: typeof (window as any).FlutterChannel,
    },
  };
  console.log('[FlutterBridge]', event, data);

  // Fire and forget - send to backend
  fetch(`${API_URL}/api/debug/flutter-bridge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
};

declare global {
  interface Window {
    Flutter?: any;
    FlutterChannel?: any;
    flutterMessageCallback?: (message: any) => void;
    handleFlutterMessage?: (message: any) => void;
    // Additional handlers that Flutter's runJavaScript might call
    receiveMessageFromFlutter?: (message: any) => void;
    onFlutterMessage?: (message: any) => void;
    handleMessage?: (message: any) => void;
  }
}

export function useFlutterBridge() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isFlutterApp, setIsFlutterApp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logToBackend('init', {
      windowFlutter: typeof window.Flutter,
      windowFlutterChannel: typeof (window as any).FlutterChannel,
    });

    // Global message handler that Flutter can call directly
    const handleMessage = (message: any) => {
      logToBackend('message_received', { message });

      // Handle dataUpdate with token
      if (message.type === 'dataUpdate' && message.data?.token) {
        logToBackend('got_dataUpdate_with_token', { tokenLength: message.data.token.length });
        decodeAndSetUserId(message.data.token);
      }
      // Also handle direct token in message
      else if (message.token) {
        logToBackend('got_direct_token', { tokenLength: message.token.length });
        decodeAndSetUserId(message.token);
      }
      // Handle if data.token exists at top level
      else if (message.data && typeof message.data === 'string') {
        logToBackend('got_string_data', { dataLength: message.data.length });
        decodeAndSetUserId(message.data);
      } else {
        logToBackend('unknown_message_format', { message });
      }
    };

    // Decode token and extract userId
    const decodeAndSetUserId = (token: string) => {
      try {
        logToBackend('decoding_token', { tokenLength: token.length, preview: token.substring(0, 50) });

        // Try base64 decode
        const decoded = JSON.parse(atob(token));
        logToBackend('token_decoded', { decoded });

        if (decoded.userId) {
          logToBackend('userId_found', { userId: decoded.userId });
          setUserId(decoded.userId);
          setIsFlutterApp(true);
        } else {
          logToBackend('no_userId_in_token', { decoded });
          setError('userId not found in token');
        }
      } catch (err: any) {
        logToBackend('decode_error', { error: err.message, token: token.substring(0, 100) });
        setError('Failed to decode: ' + err.message);
      }
    };

    // Register global handlers that Flutter can call via runJavaScript
    window.flutterMessageCallback = handleMessage;
    window.handleFlutterMessage = handleMessage;
    window.receiveMessageFromFlutter = handleMessage;
    window.onFlutterMessage = handleMessage;
    window.handleMessage = handleMessage;

    logToBackend('handlers_registered', { handlers: ['flutterMessageCallback', 'handleFlutterMessage', 'receiveMessageFromFlutter', 'onFlutterMessage', 'handleMessage'] });

    // Send message to Flutter via JavaScript channel
    const sendToFlutter = (type: string, data: Record<string, any> = {}) => {
      const message = JSON.stringify({ type, ...data });

      // Try FlutterChannel first (webview_flutter uses this)
      if ((window as any).FlutterChannel?.postMessage) {
        logToBackend('sending_via_FlutterChannel', { type, message });
        (window as any).FlutterChannel.postMessage(message);
        return true;
      }
      // Try Flutter.postMessage
      if (window.Flutter?.postMessage) {
        logToBackend('sending_via_Flutter', { type, message });
        window.Flutter.postMessage(message);
        return true;
      }
      logToBackend('no_channel_to_send', { type });
      return false;
    };

    // Check for various Flutter bridge patterns
    const checkFlutterBridge = () => {
      // Pattern 1: Check for FlutterChannel (webview_flutter's JavaScriptChannel)
      if ((window as any).FlutterChannel?.postMessage) {
        logToBackend('found_FlutterChannel');
        setIsFlutterApp(true);

        // Step 1: Send ready signal
        sendToFlutter('ready', { status: 'initialized', timestamp: new Date().toISOString() });

        // Step 2: Request data (token) from Flutter - THIS IS THE KEY!
        setTimeout(() => {
          sendToFlutter('requestData', {});
        }, 100);

        return true;
      }

      // Pattern 2: window.Flutter with postMessage
      if (window.Flutter && typeof window.Flutter.postMessage === 'function') {
        logToBackend('found_Flutter_postMessage');
        setIsFlutterApp(true);

        if (typeof window.Flutter.onMessage === 'function') {
          logToBackend('setting_up_Flutter_onMessage');
          window.Flutter.onMessage(handleMessage);
        }

        // Step 1: Send ready signal
        sendToFlutter('ready', { status: 'initialized', timestamp: new Date().toISOString() });

        // Step 2: Request data (token) from Flutter
        setTimeout(() => {
          sendToFlutter('requestData', {});
        }, 100);

        return true;
      }

      // Pattern 3: Check user agent for WebView indicators
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('flutter') || ua.includes('dart') || ua.includes('wv')) {
        logToBackend('detected_via_userAgent', { ua });
        setIsFlutterApp(true);
        return true;
      }

      return false;
    };

    // Try immediate check
    if (checkFlutterBridge()) {
      return;
    }

    // Wait for Flutter bridge to be injected
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds

    const interval = setInterval(() => {
      attempts++;

      if (checkFlutterBridge()) {
        clearInterval(interval);
        logToBackend('bridge_found_after_attempts', { attempts });
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        logToBackend('no_bridge_found', { attempts });
      }
    }, 100);

    return () => {
      clearInterval(interval);
      // Clean up global handlers
      delete window.flutterMessageCallback;
      delete window.handleFlutterMessage;
      delete window.receiveMessageFromFlutter;
      delete window.onFlutterMessage;
      delete window.handleMessage;
    };
  }, []);

  return {
    userId,
    isFlutterApp,
    error,
  };
}
