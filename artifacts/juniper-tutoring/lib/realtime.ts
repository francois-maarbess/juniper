import { io } from 'socket.io-client';
import { getApiOrigin, getCurrentAccessToken } from '@/lib/api';

export function createJuniperRealtimeSocket() {
  const origin = getApiOrigin();
  if (!origin || !getCurrentAccessToken()) return null;
  return io(`${origin}/realtime`, {
    transports: ['websocket'],
    auth: (callback) => callback({ accessToken: getCurrentAccessToken() }),
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8_000,
    timeout: 8_000,
  });
}

export function createJuniperWorkroomSocket() {
  const origin = getApiOrigin();
  if (!origin || !getCurrentAccessToken()) return null;
  return io(`${origin}/workroom`, {
    transports: ['websocket'],
    auth: (callback) => callback({ accessToken: getCurrentAccessToken() }),
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8_000,
    timeout: 8_000,
  });
}
