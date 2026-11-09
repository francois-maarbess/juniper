import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createJuniperWorkroomSocket } from '@/lib/realtime';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'disconnected' | 'failed';

type NativeWebRTC = {
  RTCPeerConnection: new (configuration?: RTCConfiguration) => RTCPeerConnection;
  RTCSessionDescription: new (description: RTCSessionDescriptionInit) => RTCSessionDescription;
  RTCIceCandidate: new (candidate: RTCIceCandidateInit) => RTCIceCandidate;
  mediaDevices: { getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream> };
};

function getWebRTC() {
  if (Platform.OS === 'web') {
    return {
      RTCPeerConnection: globalThis.RTCPeerConnection,
      RTCSessionDescription: globalThis.RTCSessionDescription,
      RTCIceCandidate: globalThis.RTCIceCandidate,
      mediaDevices: globalThis.navigator?.mediaDevices,
    };
  }
  return require('react-native-webrtc') as NativeWebRTC;
}

export function useWorkroomCall(bookingId: string, targetUserId: string, request: <T>(path: string) => Promise<T>) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [callError, setCallError] = useState('');
  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const roleRef = useRef<'caller' | 'receiver' | null>(null);
  const readyRef = useRef<((ready: boolean) => void) | null>(null);
  const joinedRef = useRef(false);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanMedia = useCallback(() => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    remoteDescriptionSetRef.current = false;
    roleRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(false);
    setMuted(false);
    setCameraOff(false);
    setCallState('idle');
  }, []);

  const waitUntilReady = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return false;
    if (socket.connected && joinedRef.current) return true;
    if (!socket.connected) {
      const connected = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => { socket.off('connect', onConnect); resolve(false); }, 10_000);
        const onConnect = () => { clearTimeout(timer); resolve(true); };
        socket.once('connect', onConnect);
        socket.connect();
      });
      if (!connected) return false;
    }
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { readyRef.current = null; resolve(false); }, 10_000);
      readyRef.current = (ready) => { clearTimeout(timer); readyRef.current = null; resolve(ready); };
      socket.emit('join:booking', { bookingId }, (ack: { ok?: boolean } | undefined) => {
        const joined = Boolean(ack?.ok);
        joinedRef.current = joined;
        readyRef.current?.(joined);
      });
    });
  }, [bookingId]);

  const getLocalMedia = useCallback(async () => {
    const rtc = getWebRTC();
    if (!rtc.RTCPeerConnection || !rtc.mediaDevices?.getUserMedia) {
      throw new Error('Video calls are not available in this browser or device build. Update Juniper and try again.');
    }
    const stream = await rtc.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
    localRef.current = stream;
    setLocalStream(stream);
    return { rtc, stream };
  }, []);

  const applyOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const peer = peerRef.current;
    const socket = socketRef.current;
    if (!peer || !socket || roleRef.current !== 'receiver') {
      pendingOfferRef.current = offer;
      return;
    }
    const rtc = getWebRTC();
    await peer.setRemoteDescription(new rtc.RTCSessionDescription(offer));
    remoteDescriptionSetRef.current = true;
    for (const candidate of pendingIceRef.current.splice(0)) {
      try { await peer.addIceCandidate(new rtc.RTCIceCandidate(candidate)); } catch { /* Ignore stale candidates and keep the session alive. */ }
    }
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('webrtc:answer', { bookingId, targetUserId, sdp: answer });
  }, [bookingId, targetUserId]);

  const createPeer = useCallback(async (role: 'caller' | 'receiver') => {
    const socket = socketRef.current;
    if (!socket) throw new Error('The session connection is unavailable. Reopen the workroom and try again.');
    const { rtc, stream } = await getLocalMedia();
    const iceConfig = await request<{ iceServers: RTCIceServer[] }>(`/marketplace/workroom/${bookingId}/ice-servers`);
    const peer = new rtc.RTCPeerConnection({ iceServers: iceConfig.iceServers });
    peerRef.current = peer;
    roleRef.current = role;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      const next = event.streams?.[0];
      if (next) {
        setRemoteStream(next);
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
        setCallState('connected');
        setCallError('');
      }
    };
    peer.onicecandidate = (event) => {
      if (event.candidate && socket.connected) socket.emit('webrtc:ice', { bookingId, targetUserId, candidate: event.candidate });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') {
        setCallState('failed');
        setCallError('Could not connect across this network. Check the connection or arrange another time.');
      } else if (peer.connectionState === 'disconnected') {
        setCallState('disconnected');
        setCallError('The call lost its connection. It may reconnect automatically.');
      }
    };
    if (role === 'receiver' && pendingOfferRef.current) {
      const offer = pendingOfferRef.current;
      pendingOfferRef.current = null;
      await applyOffer(offer);
    }
    return peer;
  }, [applyOffer, bookingId, getLocalMedia, request, targetUserId]);

  useEffect(() => {
    if (!bookingId || !targetUserId) return;
    const socket = createJuniperWorkroomSocket();
    if (!socket) {
      setCallError('Sign in again to start a tutoring call.');
      return;
    }
    socketRef.current = socket;
    socket.on('connect', () => {
      joinedRef.current = false;
      socket.emit('join:booking', { bookingId }, (ack: { ok?: boolean } | undefined) => {
        joinedRef.current = Boolean(ack?.ok);
      });
    });
    socket.on('call:start', (event: any) => {
      if (event.bookingId === bookingId && event.fromUserId === targetUserId) {
        setIncomingCall(true);
        setCallState('ringing');
        setCallError('');
      }
    });
    socket.on('call:accepted', async (event: any) => {
      if (event.bookingId !== bookingId || event.fromUserId !== targetUserId || roleRef.current !== 'caller') return;
      try {
        const peer = peerRef.current ?? await createPeer('caller');
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('webrtc:offer', { bookingId, targetUserId, sdp: offer });
      } catch (error) {
        setCallState('failed');
        setCallError(error instanceof Error ? error.message : 'The call could not be started. Check camera and microphone access.');
      }
    });
    socket.on('webrtc:offer', (event: any) => {
      if (event.bookingId !== bookingId || event.fromUserId !== targetUserId) return;
      void applyOffer(event.sdp).catch((error: unknown) => {
        setCallState('failed');
        setCallError(error instanceof Error ? error.message : 'The other person could not be connected.');
      });
    });
    socket.on('webrtc:answer', async (event: any) => {
      const peer = peerRef.current;
      if (event.bookingId !== bookingId || event.fromUserId !== targetUserId || !peer) return;
      try {
        const rtc = getWebRTC();
        await peer.setRemoteDescription(new rtc.RTCSessionDescription(event.sdp));
        remoteDescriptionSetRef.current = true;
        for (const candidate of pendingIceRef.current.splice(0)) {
          try { await peer.addIceCandidate(new rtc.RTCIceCandidate(candidate)); } catch { /* Ignore an expired candidate. */ }
        }
      } catch (error) {
        setCallState('failed');
        setCallError(error instanceof Error ? error.message : 'The call could not be connected.');
      }
    });
    socket.on('webrtc:ice', async (event: any) => {
      if (event.bookingId !== bookingId || event.fromUserId !== targetUserId || !event.candidate) return;
      const peer = peerRef.current;
      if (!peer || !remoteDescriptionSetRef.current) {
        pendingIceRef.current.push(event.candidate);
        return;
      }
      try { await peer.addIceCandidate(new (getWebRTC().RTCIceCandidate)(event.candidate)); } catch { /* Ignore candidates that arrived after teardown. */ }
    });
    socket.on('call:end', (event: any) => {
      if (event.bookingId === bookingId && event.fromUserId === targetUserId) {
        cleanMedia();
        setCallError('The other person ended the call.');
      }
    });
    socket.on('disconnect', () => {
      if (peerRef.current) {
        setCallState('disconnected');
        setCallError('The call connection was interrupted. Reconnect or arrange another time.');
      }
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      cleanMedia();
    };
  // Socket listeners intentionally stay bound to this booking and participant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, targetUserId]);

  const startCall = useCallback(async () => {
    setCallError('');
    setCallState('connecting');
    const ready = await waitUntilReady();
    if (!ready) {
      setCallState('failed');
      setCallError('Could not connect to the session. Check your connection and try again.');
      return;
    }
    try {
      await createPeer('caller');
      setCallState('ringing');
      socketRef.current?.emit('call:start', { bookingId, targetUserId });
      ringTimeoutRef.current = setTimeout(() => {
        if (!remoteDescriptionSetRef.current && peerRef.current) {
          cleanMedia();
          setCallError('No answer yet. Send a message to arrange another time.');
        }
      }, 45_000);
    } catch (error) {
      cleanMedia();
      setCallState('failed');
      setCallError(error instanceof Error ? error.message : 'Allow camera and microphone access, then try again.');
    }
  }, [bookingId, cleanMedia, createPeer, targetUserId, waitUntilReady]);

  const acceptCall = useCallback(async () => {
    setCallError('');
    setCallState('connecting');
    const ready = await waitUntilReady();
    if (!ready) {
      setCallState('failed');
      setCallError('Could not connect to the session. Check your connection and try again.');
      return;
    }
    try {
      await createPeer('receiver');
      setIncomingCall(false);
      socketRef.current?.emit('call:accept', { bookingId, targetUserId });
    } catch (error) {
      cleanMedia();
      setCallState('failed');
      setCallError(error instanceof Error ? error.message : 'Allow camera and microphone access, then try again.');
    }
  }, [bookingId, cleanMedia, createPeer, targetUserId, waitUntilReady]);

  const endCall = useCallback(() => {
    socketRef.current?.emit('call:end', { bookingId, targetUserId });
    cleanMedia();
  }, [bookingId, cleanMedia, targetUserId]);

  const declineCall = useCallback(() => {
    setIncomingCall(false);
    setCallState('idle');
    socketRef.current?.emit('call:end', { bookingId, targetUserId });
  }, [bookingId, targetUserId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setCameraOff(next);
  }, [cameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (Platform.OS !== 'web' || !globalThis.navigator?.mediaDevices?.getDisplayMedia || !peerRef.current) {
      setCallError('Screen sharing is available in the web version of Juniper.');
      return;
    }
    try {
      const screen = await globalThis.navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      const sender = peerRef.current.getSenders().find((item) => item.track?.kind === 'video');
      if (sender && track) await sender.replaceTrack(track);
      track.onended = () => { void toggleCamera(); };
    } catch {
      setCallError('Screen sharing was cancelled or unavailable.');
    }
  }, [toggleCamera]);

  return { callState, localStream, remoteStream, muted, cameraOff, incomingCall, callError, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera, toggleScreenShare };
}
