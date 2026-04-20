import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy singletons — only initialized in the browser
let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;

function getApp(): FirebaseApp {
  if (!_app) {
    console.log("[Firebase] config check:", {
      apiKey: firebaseConfig.apiKey ? "satt" : "MANGLER",
      projectId: firebaseConfig.projectId ?? "MANGLER",
      authDomain: firebaseConfig.authDomain ?? "MANGLER",
    });
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (!_db) {
    _db = initializeFirestore(getApp(), {
      experimentalForceLongPolling: true,
    });
  }
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getApp());
  return _storage;
}

// Convenience proxies for code that imports these directly
export const auth = typeof window !== "undefined" ? getFirebaseAuth() : ({} as Auth);
export const db = typeof window !== "undefined" ? getFirebaseDb() : ({} as Firestore);

export default getApp;
