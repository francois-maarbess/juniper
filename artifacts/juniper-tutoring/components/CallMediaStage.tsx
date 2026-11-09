import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { CallState } from '@/hooks/useWorkroomCall';

export function CallMediaStage({
  localStream,
  remoteStream,
  callState,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callState: CallState;
}) {
  const colors = useColors();
  const localVideo = useRef<any>(null);
  const remoteVideo = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (localVideo.current) localVideo.current.srcObject = localStream;
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
  }, [localStream, remoteStream]);

  const nativeRTCView = Platform.OS !== 'web' ? require('react-native-webrtc').RTCView : null;
  const VideoView = nativeRTCView;
  const isConnected = callState === 'connected';

  return (
    <View style={[styles.stage, { backgroundColor: '#15231D', borderColor: colors.border }]}>
      {remoteStream ? (
        Platform.OS === 'web'
          ? React.createElement('video' as any, { ref: remoteVideo, autoPlay: true, playsInline: true, style: styles.remoteVideo })
          : <VideoView streamURL={(remoteStream as any).toURL()} objectFit="cover" style={styles.remoteVideo} />
      ) : (
        <View style={styles.waiting}>
          <Text style={styles.title}>{isConnected ? 'Connecting audio and video…' : 'Waiting for your tutor to join'}</Text>
          <Text style={styles.subtitle}>Keep this screen open. You can continue chatting while the connection starts.</Text>
        </View>
      )}
      {localStream ? (
        <View style={styles.localPreview}>
          {Platform.OS === 'web'
            ? React.createElement('video' as any, { ref: localVideo, autoPlay: true, playsInline: true, muted: true, style: styles.localVideo })
            : <VideoView streamURL={(localStream as any).toURL()} mirror objectFit="cover" style={styles.localVideo} />}
          <Text style={styles.youLabel}>You</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { borderRadius: 19, borderWidth: 1, height: 250, marginHorizontal: 16, marginTop: 10, overflow: 'hidden', position: 'relative' },
  remoteVideo: { height: '100%', width: '100%', objectFit: 'cover' as any },
  waiting: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 15, textAlign: 'center' },
  subtitle: { color: '#D6E1DA', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 290, textAlign: 'center' },
  localPreview: { backgroundColor: '#283B32', borderColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, bottom: 12, height: 88, overflow: 'hidden', position: 'absolute', right: 12, width: 66 },
  localVideo: { height: '100%', width: '100%', objectFit: 'cover' as any },
  youLabel: { backgroundColor: '#15231DCC', bottom: 4, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 9, left: 5, overflow: 'hidden', paddingHorizontal: 4, position: 'absolute' },
});
