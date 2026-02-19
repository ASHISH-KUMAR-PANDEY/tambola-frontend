# Flutter Bridge Integration Guide

## Overview
This guide explains how to integrate the Tambola web app with your Flutter app using WebView and JWT authentication.

## Entry Point
Flutter app should open WebView with this URL:
```
https://your-tambola-domain.com/flutter-bridge.html
```

## How It Works

### Option 1: Direct userId in URL (Recommended)
If you already have the userId, just pass it directly:
```dart
// Flutter code
final String userId = "user123";
final String url = "https://your-tambola-domain.com/?userId=$userId";

// Open WebView with this URL
```

### Option 2: JWT Token via Bridge
If userId is not in URL, the bridge will request JWT token from Flutter:

```dart
// Flutter WebView setup
WebView(
  initialUrl: 'https://your-tambola-domain.com/flutter-bridge.html',
  javascriptMode: JavascriptMode.unrestricted,
  javascriptChannels: {
    JavascriptChannel(
      name: 'Flutter',
      onMessageReceived: (JavascriptMessage message) {
        // Bridge will send: requestAuthToken
        final data = jsonDecode(message.message);

        if (data['type'] == 'requestAuthToken') {
          // Send JWT token back to bridge
          _webViewController.runJavascript('''
            Flutter.onMessage({
              type: 'auth_token',
              token: '${yourJwtToken}'
            });
          ''');
        }
      },
    ),
  },
  onWebViewCreated: (WebViewController controller) {
    _webViewController = controller;

    // Inject Flutter bridge
    controller.runJavascript('''
      window.Flutter = {
        postMessage: function(type, data) {
          window.FlutterChannel.postMessage(JSON.stringify({
            type: type,
            ...data
          }));
        },
        onMessage: function(callback) {
          window.flutterMessageCallback = callback;
        }
      };

      // Call the registered callback when Flutter sends message
      function handleFlutterMessage(message) {
        if (window.flutterMessageCallback) {
          window.flutterMessageCallback(message);
        }
      }
    ''');
  },
)
```

## JWT Token Format

The JWT token should contain `userId` in its payload:

```json
{
  "userId": "user123",
  "exp": 1234567890,
  ... other claims
}
```

### Example JWT Structure:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMTIzIiwiZXhwIjoxNzA4MzQ1Njc4fQ.signature
```

Decoded payload:
```json
{
  "userId": "user123",
  "exp": 1708345678
}
```

## Message Protocol

### From Bridge to Flutter:
```javascript
// Request auth token
Flutter.postMessage('requestAuthToken', {
  timestamp: '2024-02-19T12:00:00.000Z'
});
```

### From Flutter to Bridge:
```javascript
// Send auth token
Flutter.onMessage({
  type: 'auth_token',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});

// Or send error
Flutter.onMessage({
  type: 'error',
  message: 'Token not available'
});
```

## Flow Diagram

```
┌─────────────┐
│ Flutter App │
└──────┬──────┘
       │ User clicks CTA
       │
       ▼
┌──────────────────────────────────────┐
│ Open WebView                         │
│ URL: /flutter-bridge.html            │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Bridge checks URL for userId param   │
└──────┬───────────────────────────────┘
       │
       ├─── userId in URL? ────┐
       │                       │
     YES                      NO
       │                       │
       │                       ▼
       │              ┌────────────────────┐
       │              │ Request JWT from   │
       │              │ Flutter via bridge │
       │              └────────┬───────────┘
       │                       │
       │                       ▼
       │              ┌────────────────────┐
       │              │ Decode JWT         │
       │              │ Extract userId     │
       │              └────────┬───────────┘
       │                       │
       └───────────────────────┘
                      │
                      ▼
       ┌──────────────────────────────────┐
       │ Redirect to /?userId=...         │
       └──────┬───────────────────────────┘
              │
              ▼
       ┌──────────────────────────────────┐
       │ Auto-login works on root URL     │
       │ User is logged in to Tambola     │
       └──────────────────────────────────┘
```

## Testing

### Test with userId in URL:
```
https://your-tambola-domain.com/flutter-bridge.html?userId=testuser123
```
Should immediately redirect to `/?userId=testuser123` and auto-login should work.

### Test with JWT token:
1. Open: `https://your-tambola-domain.com/flutter-bridge.html`
2. Open browser console
3. Simulate Flutter sending token:
```javascript
// Manually trigger the flow for testing
Flutter.onMessage({
  type: 'auth_token',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0dXNlcjEyMyJ9.signature'
});
```

## Error Handling

The bridge handles these error cases:
1. **No userId in URL and Flutter bridge timeout** → Redirects to main page (normal login)
2. **Invalid JWT format** → Shows error, redirects to main page after 3s
3. **JWT missing userId field** → Shows error, redirects to main page after 3s
4. **Flutter sends error message** → Shows error to user

## Production Deployment

1. The bridge file is located at: `/public/flutter-bridge.html`
2. After build, it will be available at: `https://your-domain.com/flutter-bridge.html`
3. Update your Flutter app to use the production URL

## Security Notes

1. **JWT Validation**: The bridge only decodes the JWT on client-side to extract userId. The backend still validates the JWT for security.
2. **HTTPS Required**: Always use HTTPS in production for secure token transmission.
3. **Token Expiry**: Ensure your JWT has reasonable expiry time (e.g., 1 hour).
4. **No Token Storage**: The bridge doesn't store the token - it only extracts userId and redirects.

## Support

For issues or questions, contact the development team.
