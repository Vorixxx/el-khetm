// ========================
// EL-KHETM — Socket.io Connection Hook
// ========================

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@el-khetm/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Generate or retrieve a persistent session ID
function getSessionId(): string {
  const KEY = 'el-khetm-session-id';
  let sessionId = localStorage.getItem(KEY);
  if (!sessionId) {
    sessionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(KEY, sessionId);
  }
  return sessionId;
}

export const sessionId = getSessionId();

// Singleton socket instance
let socketInstance: TypedSocket | null = null;

function getExplicitServerUrl(): string | null {
  try {
    const param = new URLSearchParams(window.location.search).get('server');
    if (param) {
      const parsed = new URL(param);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const clean = parsed.origin;
        sessionStorage.setItem('el-khetm-server-url', clean);
        return clean;
      }
    }
    const stored = sessionStorage.getItem('el-khetm-server-url');
    if (stored) return stored;
  } catch {
    // Ignore malformed query parameter
  }
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (!envUrl) return null;
  const trimmed = String(envUrl).trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getServerUrl(): string {
  return getExplicitServerUrl() || window.location.origin;
}

function createSocket(): TypedSocket {
  if (socketInstance) return socketInstance;

  const url = getServerUrl();
  socketInstance = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 10000,
    autoConnect: true,
  }) as TypedSocket;

  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef<TypedSocket>(createSocket());
  const [isConnected, setIsConnected] = useState(socketRef.current.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;

    function onConnect() {
      setIsConnected(true);
      setIsReconnecting(false);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onReconnectAttempt() {
      setIsReconnecting(true);
    }

    function onReconnect() {
      setIsConnected(true);
      setIsReconnecting(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);

    // Connect if not already
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  const isVercelWithoutServer =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.vercel.app') &&
    !getExplicitServerUrl();

  return {
    socket: socketRef.current,
    isConnected,
    isReconnecting,
    isVercelWithoutServer,
    sessionId,
  };
}
