// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel as _setLogLevel } from 'firebase/firestore';

// Optional: copy your LOCAL_FIREBASE_CONFIG from App.jsx (or inject via env)
const LOCAL_FIREBASE_CONFIG = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
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
export default LOCAL_FIREBASE_CONFIG;