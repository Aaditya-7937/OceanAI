// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel as _setLogLevel } from 'firebase/firestore';

// Optional: copy your LOCAL_FIREBASE_CONFIG from App.jsx (or inject via env)
const LOCAL_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCoB39FMopAYi6rsEl__8Yc0Bwu9_KlcLc",
    authDomain: "ocean-44277.firebaseapp.com",
    projectId: "ocean-44277",
    storageBucket: "ocean-44277.firebasestorage.app",
    messagingSenderId: "188628002836",
    appId: "1:188628002836:web:a68c99e19b949f770edf01",
    measurementId: "G-69FYFGLW8E"
};

const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : LOCAL_FIREBASE_CONFIG;

const firebaseApp = initializeApp(firebaseConfig);

// Export auth and db singletons
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const appId = LOCAL_FIREBASE_CONFIG.projectId;
// Keep same log level behavior you had
_setLogLevel && _setLogLevel('debug');
export { firebaseApp, auth, db, appId };