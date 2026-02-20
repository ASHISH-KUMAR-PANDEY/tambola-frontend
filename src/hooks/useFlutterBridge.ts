import { useEffect, useState } from 'react';

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
    console.log('[FlutterBridge] Initializing...');
    console.log('[FlutterBridge] window.Flutter:', typeof window.Flutter);
    console.log('[FlutterBridge] window.FlutterChannel:', typeof window.FlutterChannel);
    console.log('[FlutterBridge] User Agent:', navigator.userAgent);

    // Global message handler that Flutter can call directly
    const handleMessage = (message: any) => {
      console.log('[FlutterBridge] 📥 Received message:', JSON.stringify(message));

      // Handle dataUpdate with token
      if (message.type === 'dataUpdate' && message.data?.token) {
        console.log('[FlutterBridge] Got dataUpdate with token');
        decodeAndSetUserId(message.data.token);
      }
      // Also handle direct token in message
      else if (message.token) {
        console.log('[FlutterBridge] Got direct token in message');
        decodeAndSetUserId(message.token);
      }
      // Handle if data.token exists at top level
      else if (message.data && typeof message.data === 'string') {
        console.log('[FlutterBridge] Got string data, trying to decode as token');
        decodeAndSetUserId(message.data);
      }
    };

    // Decode token and extract userId
    const decodeAndSetUserId = (token: string) => {
      try {
        console.log('[FlutterBridge] Decoding token, length:', token.length);
        console.log('[FlutterBridge] Token preview:', token.substring(0, 50) + '...');

        // Try base64 decode
        const decoded = JSON.parse(atob(token));
        console.log('[FlutterBridge] Decoded:', JSON.stringify(decoded));

        if (decoded.userId) {
          console.log('[FlutterBridge] ✅ Found userId:', decoded.userId);
          setUserId(decoded.userId);
          setIsFlutterApp(true);
        } else {
          console.error('[FlutterBridge] ❌ No userId in decoded token');
          setError('userId not found in token');
        }
      } catch (err: any) {
        console.error('[FlutterBridge] ❌ Decode error:', err.message);
        setError('Failed to decode: ' + err.message);
      }
    };

    // Register global handlers that Flutter can call via runJavaScript
    // Flutter typically calls: window.handleMessage({...}) or similar
    window.flutterMessageCallback = handleMessage;
    window.handleFlutterMessage = handleMessage;
    window.receiveMessageFromFlutter = handleMessage;
    window.onFlutterMessage = handleMessage;
    window.handleMessage = handleMessage;

    console.log('[FlutterBridge] ✅ Registered global handlers: flutterMessageCallback, handleFlutterMessage, receiveMessageFromFlutter, onFlutterMessage, handleMessage');

    // Send message to Flutter via JavaScript channel
    const sendToFlutter = (type: string, data: Record<string, any> = {}) => {
      const message = JSON.stringify({ type, ...data });
      console.log('[FlutterBridge] 📤 Sending to Flutter:', message);

      // Try FlutterChannel first (webview_flutter uses this)
      if ((window as any).FlutterChannel?.postMessage) {
        (window as any).FlutterChannel.postMessage(message);
        return true;
      }
      // Try Flutter.postMessage
      if (window.Flutter?.postMessage) {
        window.Flutter.postMessage(message);
        return true;
      }
      return false;
    };

    // Check for various Flutter bridge patterns
    const checkFlutterBridge = () => {
      // Pattern 1: Check for FlutterChannel (webview_flutter's JavaScriptChannel)
      if ((window as any).FlutterChannel?.postMessage) {
        console.log('[FlutterBridge] ✅ Found window.FlutterChannel.postMessage');
        setIsFlutterApp(true);

        // Step 1: Send ready signal
        sendToFlutter('ready', { status: 'initialized', timestamp: new Date().toISOString() });
        console.log('[FlutterBridge] ✅ Sent ready signal');

        // Step 2: Request data (token) from Flutter - THIS IS THE KEY!
        setTimeout(() => {
          sendToFlutter('requestData', {});
          console.log('[FlutterBridge] ✅ Sent requestData to Flutter');
        }, 100);

        return true;
      }

      // Pattern 2: window.Flutter with postMessage
      if (window.Flutter && typeof window.Flutter.postMessage === 'function') {
        console.log('[FlutterBridge] ✅ Found window.Flutter.postMessage');
        setIsFlutterApp(true);

        if (typeof window.Flutter.onMessage === 'function') {
          console.log('[FlutterBridge] Setting up Flutter.onMessage listener');
          window.Flutter.onMessage(handleMessage);
        }

        // Step 1: Send ready signal
        sendToFlutter('ready', { status: 'initialized', timestamp: new Date().toISOString() });
        console.log('[FlutterBridge] ✅ Sent ready signal');

        // Step 2: Request data (token) from Flutter
        setTimeout(() => {
          sendToFlutter('requestData', {});
          console.log('[FlutterBridge] ✅ Sent requestData to Flutter');
        }, 100);

        return true;
      }

      // Pattern 3: Check user agent for WebView indicators
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('flutter') || ua.includes('dart') || ua.includes('wv')) {
        console.log('[FlutterBridge] ✅ Flutter/WebView detected in user agent');
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
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.log('[FlutterBridge] No Flutter bridge found after', attempts, 'attempts');
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
