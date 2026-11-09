import {
  OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    credentials: true,
    origin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
      if (!origin) return callback(null, true);
      const local = process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      callback(null, origin === process.env.APP_ORIGIN || local);
    },
  },
  transports: ['websocket', 'polling'],
})
export class MarketplaceRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly recheckTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: Socket) {
    const tokenValue = client.handshake.auth?.accessToken;
    const token = typeof tokenValue === 'string' ? tokenValue : '';
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const authenticated = await this.auth.authenticateAccessToken(token);
      client.data.userId = authenticated.user.id;
      client.data.accessToken = token;
      await client.join(`user:${authenticated.user.id}`);
      const timer = setInterval(() => {
        void this.auth.authenticateAccessToken(token).catch(() => client.disconnect(true));
      }, 60_000);
      this.recheckTimers.set(client.id, timer);
    } catch {
      client.disconnect(true);
      return;
    }
  }

  handleDisconnect(client: Socket) {
    const timer = this.recheckTimers.get(client.id);
    if (timer) clearInterval(timer);
    this.recheckTimers.delete(client.id);
  }

  emitUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
