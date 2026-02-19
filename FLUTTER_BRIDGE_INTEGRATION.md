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

### Option 2: Base64 Token via Bridge
If userId is not in URL, the bridge will receive base64-encoded token from Flutter:

```dart
// Flutter WebView setup
WebView(
  initialUrl: 'https://your-tambola-domain.com/flutter-bridge.html',
  javascriptMode: JavascriptMode.unrestricted,
  javascriptChannels: {
    JavascriptChannel(
      name: 'Flutter',
      onMessageReceived: (JavascriptMessage message) {
        // Bridge will send: 'ready' signal when initialized
        final data = jsonDecode(message.message);

        if (data['type'] == 'ready') {
          // Prepare token data
          final tokenData = {
            'userId': 'your_user_id_here', // e.g., '66d82fddce84f9482889e0d1'
            // Add any other data you need
          };

          // Encode to base64
          final jsonString = jsonEncode(tokenData);
          final base64Token = base64Encode(utf8.encode(jsonString));

          // Send dataUpdate message with token
          _webViewController.runJavascript('''
            if (window.flutterMessageCallback) {
              window.flutterMessageCallback({
                type: 'dataUpdate',
                data: {
                  token: '$base64Token'
                }
              });
            }
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
          window.Flutter.postMessage(JSON.stringify({
            type: type,
            ...data
          }));
        },
        onMessage: function(callback) {
          window.flutterMessageCallback = callback;
        }
      };
    ''');
  },
)
```

## Token Format

The token should be **base64-encoded JSON** containing `userId`:

### Step 1: Prepare JSON data
```json
{
  "userId": "66d82fddce84f9482889e0d1"
}
```

### Step 2: Encode to base64
```dart
final tokenData = {'userId': '66d82fddce84f9482889e0d1'};
final jsonString = jsonEncode(tokenData);
final base64Token = base64Encode(utf8.encode(jsonString));
// Result: eyJ1c2VySWQiOiI2NmQ4MmZkZGNlODRmOTQ4Mjg4OWUwZDEifQ==
```

### Step 3: Send via dataUpdate
```javascript
Flutter.onMessage({
  type: 'dataUpdate',
  data: {
    token: 'eyJ1c2VySWQiOiI2NmQ4MmZkZGNlODRmOTQ4Mjg4OWUwZDEifQ=='
  }
});
```

## Message Protocol

### From Bridge to Flutter:
```javascript
// Bridge sends 'ready' signal when initialized
Flutter.postMessage('ready', {
  status: 'initialized',
  timestamp: '2024-02-19T12:00:00.000Z'
});
```

### From Flutter to Bridge:
```javascript
// Send dataUpdate with base64-encoded token
Flutter.onMessage({
  type: 'dataUpdate',
  data: {
    token: 'eyJ1c2VySWQiOiI2NmQ4MmZkZGNlODRmOTQ4Mjg4OWUwZDEifQ==' // base64 encoded
  }
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
       │              │ Send 'ready' to    │
       │              │ Flutter via bridge │
       │              └────────┬───────────┘
       │                       │
       │                       ▼
       │              ┌────────────────────┐
       │              │ Flutter sends      │
       │              │ dataUpdate + token │
       │              └────────┬───────────┘
       │                       │
       │                       ▼
       │              ┌────────────────────┐
       │              │ Decode base64      │
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

### Test with base64 token:
1. Open: `https://your-tambola-domain.com/flutter-bridge.html`
2. Open browser console
3. Simulate Flutter sending token:
```javascript
// Create base64 token for testing
const tokenData = {userId: '66d82fddce84f9482889e0d1'};
const base64Token = btoa(JSON.stringify(tokenData));

// Manually trigger the flow
Flutter.onMessage({
  type: 'dataUpdate',
  data: {
    token: base64Token
  }
});
```

Or use testToken parameter directly:
```
https://your-tambola-domain.com/flutter-bridge.html?testToken=eyJ1c2VySWQiOiI2NmQ4MmZkZGNlODRmOTQ4Mjg4OWUwZDEifQ==
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

1. **Token Decoding**: The bridge only decodes the base64 token on client-side to extract userId. The backend validates the userId for security.
2. **HTTPS Required**: Always use HTTPS in production for secure token transmission.
3. **No Token Storage**: The bridge doesn't store the token - it only extracts userId and redirects.
4. **Backend Validation**: The auto-login endpoint on backend should validate the userId before granting access.

## Support

For issues or questions, contact the development team.
