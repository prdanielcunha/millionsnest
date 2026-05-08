import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "millionsnest.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "millionsnest",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "millionsnest.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if API key is provided and looks somewhat valid
const isValidApiKey = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key' && firebaseConfig.apiKey !== 'undefined';
export const app = isValidApiKey ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app) : null as any;
export const googleProvider = app ? new GoogleAuthProvider() : null as any;
