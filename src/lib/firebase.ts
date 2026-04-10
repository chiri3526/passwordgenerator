import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { type PasswordConfig, type PasswordHistoryItem, type Preset } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const googleProvider = new GoogleAuthProvider();

type PresetDocument = {
  userId: string;
  name: string;
  config: PasswordConfig;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type HistoryDocument = {
  userId: string;
  password: string;
  configSnapshot: PasswordConfig;
  note?: string;
  createdAt?: unknown;
};

function toIsoString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return undefined;
}

function compareIsoDateDesc(a?: string, b?: string) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

export function subscribeToAuth(listener: (user: User | null) => void) {
  if (!auth) {
    listener(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, listener);
}

export async function registerWithEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured.");
  await signInWithPopup(auth, googleProvider);
}

export async function logout() {
  if (!auth) throw new Error("Firebase is not configured.");
  await signOut(auth);
}

export function subscribeToPresets(userId: string, listener: (presets: Preset[]) => void) {
  if (!db) {
    listener([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "presets"), where("userId", "==", userId)),
    (snapshot) => {
      const presets = snapshot.docs
        .map((entry) => ({ id: entry.id, ...(entry.data() as PresetDocument) }))
        .map((item) => ({
          id: item.id,
          userId: item.userId,
          name: item.name,
          config: item.config,
          createdAt: toIsoString(item.createdAt),
          updatedAt: toIsoString(item.updatedAt)
        }))
        .sort((left, right) => compareIsoDateDesc(left.updatedAt, right.updatedAt)) satisfies Preset[];

      listener(presets);
    },
    (error) => {
      console.error("Failed to subscribe to presets:", error);
      listener([]);
    }
  );
}

export function subscribeToHistory(
  userId: string,
  listener: (history: PasswordHistoryItem[]) => void
) {
  if (!db) {
    listener([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "password_history"), where("userId", "==", userId)),
    (snapshot) => {
      const history = snapshot.docs
        .map((entry) => ({ id: entry.id, ...(entry.data() as HistoryDocument) }))
        .map((item) => ({
          id: item.id,
          userId: item.userId,
          password: item.password,
          configSnapshot: item.configSnapshot,
          note: item.note ?? "",
          createdAt: toIsoString(item.createdAt)
        }))
        .sort((left, right) => compareIsoDateDesc(left.createdAt, right.createdAt)) satisfies PasswordHistoryItem[];

      listener(history);
    },
    (error) => {
      console.error("Failed to subscribe to history:", error);
      listener([]);
    }
  );
}

export async function savePreset(userId: string, name: string, config: PasswordConfig) {
  if (!db) throw new Error("Firebase is not configured.");

  await addDoc(collection(db, "presets"), {
    userId,
    name,
    config,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updatePresetName(id: string, name: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "presets", id), {
    name,
    updatedAt: serverTimestamp()
  });
}

export async function deletePreset(id: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, "presets", id));
}

export async function savePasswordHistory(
  userId: string,
  password: string,
  configSnapshot: PasswordConfig,
  note: string
) {
  if (!db) throw new Error("Firebase is not configured.");

  await addDoc(collection(db, "password_history"), {
    userId,
    password,
    configSnapshot,
    note,
    createdAt: serverTimestamp()
  });
}

export async function updateHistoryNote(id: string, note: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "password_history", id), {
    note
  });
}

export async function deleteHistoryItem(id: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, "password_history", id));
}
