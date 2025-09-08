"use client";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "dummy-api-key",
  authDomain: "volleyball-stats-app-dev.firebaseapp.com",
  projectId: "volleyball-stats-app-dev",
  storageBucket: "volleyball-stats-app-dev.appspot.com",
  messagingSenderId: "dummy-sender-id",
  appId: "dummy-app-id"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

if (typeof window !== 'undefined' && window.location.hostname === "localhost") {
  console.log("Connecting to Firebase Emulator...");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export { app, auth, db };