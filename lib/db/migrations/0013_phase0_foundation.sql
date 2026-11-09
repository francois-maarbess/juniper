DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webrtc_session_status') THEN
    CREATE TYPE webrtc_session_status AS ENUM ('initiating', 'connecting', 'connected', 'disconnected', 'failed', 'ended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_presence_status') THEN
    CREATE TYPE user_presence_status AS ENUM ('online', 'away', 'offline');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sdp_offer TEXT,
  sdp_answer TEXT,
  ice_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  status webrtc_session_status NOT NULL DEFAULT 'initiating',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webrtc_sessions_booking_idx ON webrtc_sessions (booking_id, created_at);
CREATE INDEX IF NOT EXISTS webrtc_sessions_initiator_idx ON webrtc_sessions (initiator_id);

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  socket_id TEXT,
  status user_presence_status NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS user_presence_status_idx ON user_presence (status);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON ai_conversations (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_conversations_booking_idx ON ai_conversations (booking_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx ON ai_messages (conversation_id, created_at);