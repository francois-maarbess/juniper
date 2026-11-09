import {
  OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage,
  WebSocketGateway, WebSocketServer, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { db, userPresence, bookings } from '@workspace/db';
import { eq, and, or } from 'drizzle-orm';

@WebSocketGateway({
  namespace: '/workroom',
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
export class WorkroomSignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly recheckTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private readonly auth: AuthService) {}

  private async isSessionPeer(bookingId: string, userId: string, targetUserId: string) {
    const [booking] = await db.select({ learnerId: bookings.learnerId, tutorId: bookings.tutorId }).from(bookings)
      .where(eq(bookings.id, bookingId)).limit(1);
    return Boolean(booking && ((booking.learnerId === userId && booking.tutorId === targetUserId) || (booking.tutorId === userId && booking.learnerId === targetUserId)));
  }

  async handleConnection(client: Socket) {
    const tokenValue = client.handshake.auth?.accessToken;
    const token = typeof tokenValue === 'string' ? tokenValue : '';
    if (!token) { client.disconnect(true); return; }
    try {
      const authenticated = await this.auth.authenticateAccessToken(token);
      client.data.userId = authenticated.user.id;
      client.data.accessToken = token;
      await client.join(`user:${authenticated.user.id}`);
      // Upsert presence
      await db.insert(userPresence).values({
        userId: authenticated.user.id,
        socketId: client.id,
        status: 'online',
        lastSeen: new Date(),
      }).onConflictDoUpdate({
        target: userPresence.userId,
        set: { socketId: client.id, status: 'online', lastSeen: new Date() },
      });
      const timer = setInterval(() => {
        void this.auth.authenticateAccessToken(token).catch(() => client.disconnect(true));
      }, 60_000);
      this.recheckTimers.set(client.id, timer);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const timer = this.recheckTimers.get(client.id);
    if (timer) clearInterval(timer);
    this.recheckTimers.delete(client.id);
    const userId = client.data?.userId;
    if (userId) {
      await db.update(userPresence).set({ status: 'offline', socketId: null, lastSeen: new Date() })
        .where(eq(userPresence.userId, userId)).catch(() => undefined);
    }
  }

  @SubscribeMessage('join:booking')
  async onJoinBooking(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string }) {
    const userId = client.data?.userId;
    if (!userId || !data?.bookingId) return;
    const [booking] = await db.select({ id: bookings.id }).from(bookings)
      .where(and(eq(bookings.id, data.bookingId), or(eq(bookings.learnerId, userId), eq(bookings.tutorId, userId)))).limit(1);
    if (!booking) return { ok: false };
    await client.join(`booking:${data.bookingId}`);
    await db.update(userPresence).set({ currentBookingId: data.bookingId, lastSeen: new Date() })
      .where(eq(userPresence.userId, userId)).catch(() => undefined);
    client.to(`booking:${data.bookingId}`).emit('presence:joined', { userId, bookingId: data.bookingId });
    return { ok: true };
  }

  @SubscribeMessage('leave:booking')
  async onLeaveBooking(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string }) {
    const userId = client.data?.userId;
    if (!userId || !data?.bookingId) return;
    await client.leave(`booking:${data.bookingId}`);
    await db.update(userPresence).set({ currentBookingId: null, lastSeen: new Date() })
      .where(eq(userPresence.userId, userId)).catch(() => undefined);
    client.to(`booking:${data.bookingId}`).emit('presence:left', { userId, bookingId: data.bookingId });
    return { ok: true };
  }

  @SubscribeMessage('webrtc:offer')
  async onOffer(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string; sdp: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('webrtc:offer', { fromUserId: userId, bookingId: data.bookingId, sdp: data.sdp });
    return { ok: true };
  }

  @SubscribeMessage('webrtc:answer')
  async onAnswer(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string; sdp: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('webrtc:answer', { fromUserId: userId, bookingId: data.bookingId, sdp: data.sdp });
    return { ok: true };
  }

  @SubscribeMessage('webrtc:ice')
  async onIce(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string; candidate: unknown }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('webrtc:ice', { fromUserId: userId, bookingId: data.bookingId, candidate: data.candidate });
    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  async onTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string }) {
    const userId = client.data?.userId;
    if (!userId) return;
    client.to(`booking:${data.bookingId}`).emit('typing:start', { userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string }) {
    const userId = client.data?.userId;
    if (!userId) return;
    client.to(`booking:${data.bookingId}`).emit('typing:stop', { userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('whiteboard:draw')
  async onWhiteboardDraw(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; element: unknown; version: number }) {
    const userId = client.data?.userId;
    if (!userId) return;
    if (!client.rooms.has(`booking:${data.bookingId}`)) return;
    client.to(`booking:${data.bookingId}`).emit('whiteboard:draw', { userId, bookingId: data.bookingId, element: data.element, version: data.version });
  }

  @SubscribeMessage('whiteboard:clear')
  async onWhiteboardClear(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; version?: number }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`)) return;
    client.to(`booking:${data.bookingId}`).emit('whiteboard:clear', { userId, bookingId: data.bookingId, version: data.version });
  }

  @SubscribeMessage('call:start')
  async onCallStart(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('call:start', { fromUserId: userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('call:accept')
  async onCallAccept(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('call:accepted', { fromUserId: userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('call:end')
  async onCallEnd(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('call:end', { fromUserId: userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('screen:share')
  async onScreenShare(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('screen:share', { fromUserId: userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('screen:stop')
  async onScreenStop(@ConnectedSocket() client: Socket, @MessageBody() data: { bookingId: string; targetUserId: string }) {
    const userId = client.data?.userId;
    if (!userId || !client.rooms.has(`booking:${data.bookingId}`) || !await this.isSessionPeer(data.bookingId, userId, data.targetUserId)) return;
    this.server.to(`user:${data.targetUserId}`).emit('screen:stop', { fromUserId: userId, bookingId: data.bookingId });
  }

  @SubscribeMessage('presence:ping')
  async onPing(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (!userId) return;
    await db.update(userPresence).set({ lastSeen: new Date() }).where(eq(userPresence.userId, userId)).catch(() => undefined);
    return { ok: true, serverTime: new Date().toISOString() };
  }

  // Helper for other services to emit to a booking room
  emitToBooking(bookingId: string, event: string, payload: unknown) {
    this.server?.to(`booking:${bookingId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
