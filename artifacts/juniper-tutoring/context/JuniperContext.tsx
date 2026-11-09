import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SAMPLE_TUTORS } from '@/constants/juniper-data';

export type AppRole = 'student' | 'tutor';
export type RequestStatus = 'open' | 'matched';

export type HelpRequest = {
  id: string;
  subject: string;
  title: string;
  details: string;
  deadline: string;
  budget: number;
  createdAt: number;
  status: RequestStatus;
  customCourse?: string | null;
  university?: string | null;
  instructionLanguage?: string | null;
};

export type TutorOffer = {
  id: string;
  requestId: string;
  tutorId: string;
  price: number;
  note: string;
  createdAt: number;
};

export type LessonBooking = {
  id: string;
  tutorId: string;
  subject: string;
  slot: string;
  price: number;
  requestId?: string;
  createdAt: number;
  status: 'upcoming' | 'completed';
};

export type ChatMessage = {
  id: string;
  bookingId: string;
  sender: 'you';
  text: string;
  createdAt: number;
};

export type TutorApplication = {
  displayName: string;
  subject: string;
  teachingApproach: string;
  hourlyRate: number;
  availability: string[];
  savedAt: number;
};

type JuniperState = {
  role: AppRole;
  tutorProfileId: string;
  tutorApplication: TutorApplication | null;
  savedTutorIds: string[];
  requests: HelpRequest[];
  offers: TutorOffer[];
  bookings: LessonBooking[];
  messages: ChatMessage[];
};

type RequestDraft = Pick<
  HelpRequest,
  'subject' | 'title' | 'details' | 'deadline' | 'budget'
>;

type JuniperContextValue = {
  state: JuniperState;
  persistenceError: boolean;
  setRole: (role: AppRole) => void;
  setTutorProfileId: (id: string) => void;
  saveTutorApplication: (
    application: Omit<TutorApplication, 'savedAt'>,
  ) => void;
  toggleSavedTutor: (id: string) => void;
  createRequest: (draft: RequestDraft) => string;
  sendOffer: (requestId: string, price: number, note: string) => void;
  bookTutor: (tutorId: string, slot: string) => string | null;
  acceptOffer: (requestId: string, offerId: string) => string | null;
  sendMessage: (bookingId: string, text: string) => void;
  completeBooking: (bookingId: string) => void;
};

const STORAGE_KEY = 'juniper.preview.v1';
const JuniperContext = createContext<JuniperContextValue | null>(null);

const initialState: JuniperState = {
  role: 'student',
  tutorProfileId: SAMPLE_TUTORS[0].id,
  tutorApplication: null,
  savedTutorIds: [],
  requests: [],
  offers: [],
  bookings: [],
  messages: [],
};

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function JuniperProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<JuniperState>(initialState);
  const [ready, setReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || !stored) return;
        const parsed = JSON.parse(stored) as Partial<JuniperState>;
        setState({
          ...initialState,
          ...parsed,
          tutorApplication: parsed.tutorApplication ?? null,
          savedTutorIds: Array.isArray(parsed.savedTutorIds) ? parsed.savedTutorIds : [],
          requests: Array.isArray(parsed.requests) ? parsed.requests : [],
          offers: Array.isArray(parsed.offers) ? parsed.offers : [],
          bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        });
      } catch {
        if (active) setPersistenceError(true);
      } finally {
        if (active) setReady(true);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      setPersistenceError(true);
    });
  }, [ready, state]);

  const setRole = useCallback((role: AppRole) => {
    setState((current) => ({ ...current, role }));
  }, []);

  const setTutorProfileId = useCallback((id: string) => {
    setState((current) => ({ ...current, tutorProfileId: id }));
  }, []);

  const saveTutorApplication = useCallback(
    (application: Omit<TutorApplication, 'savedAt'>) => {
      setState((current) => ({
        ...current,
        tutorApplication: { ...application, savedAt: Date.now() },
      }));
    },
    [],
  );

  const toggleSavedTutor = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      savedTutorIds: current.savedTutorIds.includes(id)
        ? current.savedTutorIds.filter((savedId) => savedId !== id)
        : [...current.savedTutorIds, id],
    }));
  }, []);

  const createRequest = useCallback((draft: RequestDraft) => {
    const id = createId('request');
    const request: HelpRequest = {
      ...draft,
      id,
      createdAt: Date.now(),
      status: 'open',
    };
    setState((current) => ({ ...current, requests: [request, ...current.requests] }));
    return id;
  }, []);

  const sendOffer = useCallback((requestId: string, price: number, note: string) => {
    setState((current) => {
      const existingOffer = current.offers.find(
        (offer) => offer.requestId === requestId && offer.tutorId === current.tutorProfileId,
      );
      const offer: TutorOffer = {
        id: existingOffer?.id ?? createId('offer'),
        requestId,
        tutorId: current.tutorProfileId,
        price,
        note,
        createdAt: Date.now(),
      };
      return {
        ...current,
        offers: [
          offer,
          ...current.offers.filter(
            (item) =>
              !(item.requestId === requestId && item.tutorId === current.tutorProfileId),
          ),
        ],
      };
    });
  }, []);

  const bookTutor = useCallback((tutorId: string, slot: string) => {
    const tutor = SAMPLE_TUTORS.find((item) => item.id === tutorId);
    if (!tutor) return null;

    const bookingId = createId('session');
    const booking: LessonBooking = {
      id: bookingId,
      tutorId,
      subject: tutor.subject,
      slot,
      price: tutor.hourlyRate,
      createdAt: Date.now(),
      status: 'upcoming',
    };
    setState((current) => ({ ...current, bookings: [booking, ...current.bookings] }));
    return bookingId;
  }, []);

  const acceptOffer = useCallback(
    (requestId: string, offerId: string) => {
      const offer = state.offers.find(
        (item) => item.id === offerId && item.requestId === requestId,
      );
      const request = state.requests.find((item) => item.id === requestId);
      const tutor = offer && SAMPLE_TUTORS.find((item) => item.id === offer.tutorId);
      if (!offer || !request || !tutor) return null;

      const bookingId = createId('session');
      const booking: LessonBooking = {
        id: bookingId,
        tutorId: tutor.id,
        subject: request.subject,
        slot: offer.note.includes('Today') ? offer.note : tutor.nextSlot,
        price: offer.price,
        requestId,
        createdAt: Date.now(),
        status: 'upcoming',
      };
      setState((current) => ({
        ...current,
        requests: current.requests.map((item) =>
          item.id === requestId ? { ...item, status: 'matched' } : item,
        ),
        bookings: [booking, ...current.bookings],
      }));
      return bookingId;
    },
    [state.offers, state.requests],
  );

  const sendMessage = useCallback((bookingId: string, text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const message: ChatMessage = {
      id: createId('message'),
      bookingId,
      sender: 'you',
      text: cleanText,
      createdAt: Date.now(),
    };
    setState((current) => ({ ...current, messages: [...current.messages, message] }));
  }, []);

  const completeBooking = useCallback((bookingId: string) => {
    setState((current) => ({
      ...current,
      bookings: current.bookings.map((booking) =>
        booking.id === bookingId ? { ...booking, status: 'completed' } : booking,
      ),
    }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      persistenceError,
      setRole,
      setTutorProfileId,
      saveTutorApplication,
      toggleSavedTutor,
      createRequest,
      sendOffer,
      bookTutor,
      acceptOffer,
      sendMessage,
      completeBooking,
    }),
    [
      state,
      persistenceError,
      setRole,
      setTutorProfileId,
      saveTutorApplication,
      toggleSavedTutor,
      createRequest,
      sendOffer,
      bookTutor,
      acceptOffer,
      sendMessage,
      completeBooking,
    ],
  );

  return <JuniperContext.Provider value={value}>{children}</JuniperContext.Provider>;
}

export function useJuniper() {
  const context = useContext(JuniperContext);
  if (!context) {
    throw new Error('useJuniper must be used inside JuniperProvider.');
  }
  return context;
}
