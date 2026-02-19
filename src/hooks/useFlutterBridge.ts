import { useEffect, useState } from 'react';

interface FlutterMessage {
  type: string;
  data?: {
    token?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface FlutterBridge {
  postMessage: (type: string, data: any) => void;
  onMessage: (callback: (message: FlutterMessage) => void) => void;
}

declare global {
  interface Window {
    Flutter?: FlutterBridge;
  }
}

export function useFlutterBridge() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isFlutterApp, setIsFlutterApp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[FlutterBridge] Checking for Flutter bridge...');

    // Check if Flutter bridge exists
    const checkFlutter = () => {
      if (typeof window.Flutter !== 'undefined' && typeof window.Flutter.postMessage === 'function') {
        console.log('[FlutterBridge] ✅ Flutter bridge detected!');
        setIsFlutterApp(true);
        return true;
      }
      return false;
    };

    // Try immediate check
    if (checkFlutter()) {
      setupBridge();
      return;
    }

    // Wait for Flutter bridge to be injected (max 5 seconds)
    let attempts = 0;
    const maxAttempts = 50;

    const interval = setInterval(() => {
      attempts++;

      if (checkFlutter()) {
        clearInterval(interval);
        setupBridge();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.log('[FlutterBridge] No Flutter bridge found, running as regular web app');
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const setupBridge = () => {
    if (!window.Flutter) return;

    console.log('[FlutterBridge] Setting up message listener...');

    // Listen for messages from Flutter
    window.Flutter.onMessage((message: FlutterMessage) => {
      console.log('[FlutterBridge] 📥 Received message:', message);

      if (message.type === 'dataUpdate' && message.data?.token) {
        console.log('[FlutterBridge] Got dataUpdate with token, decoding...');

        try {
          // Decode base64 token
          const decoded = JSON.parse(atob(message.data.token));
          console.log('[FlutterBridge] Decoded token:', decoded);

          if (decoded.userId) {
            console.log('[FlutterBridge] ✅ Extracted userId:', decoded.userId);
            setUserId(decoded.userId);
          } else {
            const errMsg = 'userId not found in token';
            console.error('[FlutterBridge] ❌', errMsg);
            setError(errMsg);
          }
        } catch (err: any) {
          const errMsg = 'Failed to decode token: ' + err.message;
          console.error('[FlutterBridge] ❌', errMsg);
          setError(errMsg);
        }
      }
    });

    // Send ready signal to Flutter
    try {
      window.Flutter.postMessage('ready', {
        status: 'initialized',
        timestamp: new Date().toISOString(),
      });
      console.log('[FlutterBridge] ✅ Sent "ready" signal to Flutter');
    } catch (err: any) {
      console.error('[FlutterBridge] ❌ Error sending ready signal:', err.message);
      setError('Failed to communicate with Flutter');
    }
  };

  return {
    userId,
    isFlutterApp,
    error,
  };
}
