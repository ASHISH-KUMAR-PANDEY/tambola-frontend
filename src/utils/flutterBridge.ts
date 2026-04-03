/**
 * Send a message to Flutter via JavaScriptChannel
 */
export function sendToFlutter(type: string, data: Record<string, any> = {}): void {
  const message = JSON.stringify({ type, ...data });
  (window as any).FlutterChannel?.postMessage(message);
}
