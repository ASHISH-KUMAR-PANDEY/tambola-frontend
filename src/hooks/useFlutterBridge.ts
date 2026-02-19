import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Flutter?: any;
    FlutterChannel?: any;
    flutterMessageCallback?: (message: any) => void;
    handleFlutterMessage?: (message: any) => void;
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

    // Register global handlers that Flutter can call
    window.flutterMessageCallback = handleMessage;
    window.handleFlutterMessage = handleMessage;

    // Check for various Flutter bridge patterns
    const checkFlutterBridge = () => {
      // Pattern 1: window.Flutter with postMessage and onMessage
      if (window.Flutter && typeof window.Flutter.postMessage === 'function') {
        console.log('[FlutterBridge] ✅ Found window.Flutter.postMessage');
        setIsFlutterApp(true);

        if (typeof window.Flutter.onMessage === 'function') {
          console.log('[FlutterBridge] Setting up Flutter.onMessage listener');
          window.Flutter.onMessage(handleMessage);
        }

        // Send ready signal
        try {
          window.Flutter.postMessage('ready', { status: 'initialized', timestamp: new Date().toISOString() });
          console.log('[FlutterBridge] ✅ Sent ready signal via Flutter.postMessage');
        } catch (e) {
          console.error('[FlutterBridge] Error sending ready:', e);
        }

        return true;
      }

      // Pattern 2: window.FlutterChannel (common in flutter_inappwebview)
      if (window.FlutterChannel && typeof window.FlutterChannel.postMessage === 'function') {
        console.log('[FlutterBridge] ✅ Found window.FlutterChannel');
        setIsFlutterApp(true);

        try {
          window.FlutterChannel.postMessage(JSON.stringify({ type: 'ready', status: 'initialized' }));
          console.log('[FlutterBridge] ✅ Sent ready signal via FlutterChannel');
        } catch (e) {
          console.error('[FlutterBridge] Error sending ready:', e);
        }

        return true;
      }

      // Pattern 3: Check user agent for WebView indicators
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('flutter') || ua.includes('dart')) {
        console.log('[FlutterBridge] ✅ Flutter detected in user agent');
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
    };
  }, []);

  return {
    userId,
    isFlutterApp,
    error,
  };
}
