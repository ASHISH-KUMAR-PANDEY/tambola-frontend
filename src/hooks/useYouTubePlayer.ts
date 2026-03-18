import { useEffect, useRef, useState, useCallback } from 'react';

// Global YT API loading
let apiPromise: Promise<void> | null = null;

function ensureYTAPI(): Promise<void> {
  if ((window as any).YT?.Player) {
    return Promise.resolve();
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    (window as any).onYouTubeIframeAPIReady = () => {
      resolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    } else {
      // Script exists but API not ready — poll for it
      const poll = setInterval(() => {
        if ((window as any).YT?.Player) {
          clearInterval(poll);
          resolve();
        }
      }, 200);
      setTimeout(() => clearInterval(poll), 15000);
    }
  });

  return apiPromise;
}

export type PlayerState = 'unstarted' | 'buffering' | 'playing' | 'paused' | 'ended';

interface UseYouTubePlayerOptions {
  videoId: string | null;
  containerId: string;
  autoplay?: boolean;
  startSeconds?: number;
  onStateChange?: (state: PlayerState) => void;
  onReady?: () => void;
}

export function useYouTubePlayer({
  videoId,
  containerId,
  autoplay = false,
  startSeconds,
  onStateChange,
  onReady,
}: UseYouTubePlayerOptions) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>('unstarted');
  const [currentTime, setCurrentTime] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef({ onStateChange, onReady });

  callbacksRef.current = { onStateChange, onReady };

  useEffect(() => {
    if (!videoId) return;

    let destroyed = false;

    const init = async () => {
      // Wait a tick for React to paint the container
      await new Promise((r) => requestAnimationFrame(r));
      if (destroyed) return;

      const container = document.getElementById(containerId);
      if (!container) return;

      // Build YouTube embed URL with all params baked in
      const params = new URLSearchParams({
        enablejsapi: '1',
        autoplay: autoplay ? '1' : '0',
        mute: '1',
        controls: '0',
        modestbranding: '1',
        rel: '0',
        playsinline: '1',
        disablekb: '1',
        fs: '0',
        iv_load_policy: '3',
        origin: window.location.origin,
      });
      if (startSeconds && startSeconds > 0) {
        params.set('start', String(Math.floor(startSeconds)));
      }

      // Create the iframe ourselves — this is instant and doesn't depend on YT API
      const iframeId = `${containerId}-iframe`;
      container.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      container.appendChild(iframe);

      // Now load YT API and attach to the existing iframe for JS control
      await ensureYTAPI();
      if (destroyed) return;

      const markReady = () => {
        if (destroyed || isReady) return;
        setIsReady(true);
        callbacksRef.current.onReady?.();
        // Stop fallback polling
        if (readyPollRef.current) {
          clearInterval(readyPollRef.current);
          readyPollRef.current = null;
        }
      };

      // Attach YT.Player to the existing iframe
      playerRef.current = new (window as any).YT.Player(iframeId, {
        events: {
          onReady: () => markReady(),
          onStateChange: (event: any) => {
            if (destroyed) return;
            const stateMap: Record<number, PlayerState> = {
              [-1]: 'unstarted',
              0: 'ended',
              1: 'playing',
              2: 'paused',
              3: 'buffering',
            };
            const newState = stateMap[event.data] || 'unstarted';
            setPlayerState(newState);
            callbacksRef.current.onStateChange?.(newState);

            // If we get any state change, player is definitely ready
            markReady();
          },
          onError: (event: any) => {
            console.warn('YT player error:', event.data);
          },
        },
      });

      // Fallback: poll player readiness in case onReady never fires
      readyPollRef.current = setInterval(() => {
        if (destroyed) {
          if (readyPollRef.current) clearInterval(readyPollRef.current);
          return;
        }
        try {
          const s = playerRef.current?.getPlayerState?.();
          if (typeof s === 'number') markReady();
        } catch {
          // not ready yet
        }
      }, 500);

      // Give up polling after 15s
      setTimeout(() => {
        if (readyPollRef.current) {
          clearInterval(readyPollRef.current);
          readyPollRef.current = null;
        }
      }, 15000);
    };

    init();

    return () => {
      destroyed = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (readyPollRef.current) {
        clearInterval(readyPollRef.current);
        readyPollRef.current = null;
      }
      // Don't call destroy — just null the ref. The container innerHTML
      // will be cleared on next init or React will unmount the container.
      playerRef.current = null;
      setIsReady(false);
      setPlayerState('unstarted');
      setCurrentTime(0);
    };
  }, [videoId, containerId, autoplay, startSeconds]);

  // Poll currentTime when playing
  useEffect(() => {
    if (playerState === 'playing' && playerRef.current) {
      pollRef.current = setInterval(() => {
        try {
          const t = playerRef.current?.getCurrentTime?.();
          if (typeof t === 'number') setCurrentTime(t);
        } catch {
          // ignore
        }
      }, 250);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [playerState]);

  const play = useCallback(() => {
    try { playerRef.current?.playVideo(); } catch { /* */ }
  }, []);
  const pause = useCallback(() => {
    try { playerRef.current?.pauseVideo(); } catch { /* */ }
  }, []);
  const seekTo = useCallback((seconds: number) => {
    try { playerRef.current?.seekTo(seconds, true); } catch { /* */ }
  }, []);
  const mute = useCallback(() => {
    try { playerRef.current?.mute(); } catch { /* */ }
  }, []);
  const unMute = useCallback(() => {
    try { playerRef.current?.unMute(); } catch { /* */ }
  }, []);

  return { isReady, playerState, currentTime, play, pause, seekTo, mute, unMute };
}
