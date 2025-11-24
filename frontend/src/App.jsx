import React, { useState, useEffect, useRef, useCallback } from 'react';
// import firebase singletons
import { firebaseApp, auth, db } from './firebase';
import {
    signInWithCustomToken,
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import {
    doc,
    collection,
    query,
    onSnapshot,
    addDoc,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    getDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import {
    Zap, User, Lock, Mail, ChevronLeft, LogIn, UserPlus, AlertTriangle, MessageSquare, Plus, FileText, Presentation, Settings, Trash2, Edit, Loader2, Menu, ChevronUp, ChevronDown, Save
} from 'lucide-react';
import DashboardView from './views/DashboardView.jsx';
import ConfigurationView from './views/ConfigurationView.jsx';
import OutlineView from './views/OutlineView.jsx';

// --- COMPONENT IMPORTS (From src/components/Auth & src/components/Shared) ---
import LoginView from './components/Auth/LoginView.jsx';
import RegisterView from './components/Auth/RegisterView.jsx';
import SpaceBackground from './components/Shared/SpaceBackground.jsx';
import SpaceBackgroundStyles from './components/Shared/SpaceBackgroundStyles.jsx';
import AnimatedLoader from './components/Shared/AnimatedLoader.jsx';
import RobotPeeker from './components/Shared/RobotPeeker.jsx';

// Local config fallbacks (kept for compatibility)
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Main App Component (App.jsx)
const App = () => {
    const authBoxRef = useRef(null);
    const [user, setUser] = useState(null);
    const [authStateReady, setAuthStateReady] = useState(false);
    // Views: 'login', 'register', 'dashboard', 'configure', 'outline'
    const [view, setView] = useState('login');
    const [isPasswordActive, setIsPasswordActive] = useState(false);
    const [authBoxPosition, setAuthBoxPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const [selectedProjectId, setSelectedProjectId] = useState(null); // Tracks the project currently being configured/edited

    // New: draftProject kept in memory while user toggles between configure & outline
    // Structure example: { docType: 'docx'|'pptx', mainTopic: string, outline: [...] }
    const [draftProject, setDraftProject] = useState(null);

    // 1. Firebase Initialization and Auth Logic
    useEffect(() => {
        // initialAuth uses the shared auth instance (from src/firebase.js)
        const initialAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                }
                // no anonymous fallback
            } catch (error) {
                console.error("Initial authentication failed:", error);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!authStateReady) {
                setAuthStateReady(true);
            }

            // Route management after successful authentication check
            if (currentUser) {
                // If the user logs in, immediately move to the dashboard unless they were in a configuration flow
                if (view === 'login' || view === 'register') {
                    setView('dashboard');
                }
            } else {
                // If user logs out or session ends, ensure we are on the login screen
                // BUT: don't override user intent to navigate to 'register'
                // (This prevents the auth observer from stomping a user clicking "Register here".)
                if (view !== 'register') {
                    setView('login');
                }
            }
        });

        initialAuth();

        return () => unsubscribe();
    }, [authStateReady, view]);

    // 2. Layout and Positioning Logic (for the RobotPeeker)
    useEffect(() => {
        const updatePosition = () => {
            if (authBoxRef.current) {
                const rect = authBoxRef.current.getBoundingClientRect();
                setAuthBoxPosition({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);

        if (authBoxRef.current) {
            const observer = new MutationObserver(updatePosition);
            observer.observe(authBoxRef.current, { childList: true, subtree: true, attributes: true });
            return () => {
                window.removeEventListener('resize', updatePosition);
                observer.disconnect();
            };
        } else {
            return () => window.removeEventListener('resize', updatePosition);
        }

    }, [view, authStateReady]);

    // 3. Sign Out Handler
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setSelectedProjectId(null);
            setDraftProject(null); // clear any in-memory draft when signing out
            setView('login');
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };


    // 4. Determine Current Content Component
    let CurrentContent;
    let containerClass = "w-full max-w-sm"; // Default for Login/Register

    if (!authStateReady) {
        // Loading state
        CurrentContent = <AnimatedLoader />;
        containerClass = "w-full max-w-sm";
    } else if (user) {
        // Authenticated routes
        const userDisplayName = user.displayName || user.email || user.uid;
        switch (view) {
            case 'configure':
                CurrentContent = (
                    <ConfigurationView
                        setView={setView}
                        userId={user.uid}
                        displayName={userDisplayName}
                        onSignOut={handleSignOut}
                        setSelectedProjectId={setSelectedProjectId}
                        draftProject={draftProject}
                        setDraftProject={setDraftProject}
                    />
                );
                containerClass = "w-full max-w-4xl"; // Wider container
                break;
            case 'outline':
                CurrentContent = (
                    <OutlineView
                        setView={setView}
                        userId={user.uid}
                        displayName={userDisplayName}
                        onSignOut={handleSignOut}
                        selectedProjectId={selectedProjectId}
                        setSelectedProjectId={setSelectedProjectId}
                        draftProject={draftProject}
                        setDraftProject={setDraftProject}
                    />
                );
                containerClass = "w-full max-w-4xl"; // Wider container
                break;
            case 'dashboard':
            default:
                CurrentContent = (
                    <DashboardView
                        setView={setView}
                        userId={user.uid}
                        displayName={userDisplayName}
                        onSignOut={handleSignOut}
                        setSelectedProjectId={setSelectedProjectId}
                    // not passing draftProject to dashboard by default
                    />
                );
                containerClass = "w-full max-w-7xl min-h-[90vh]"; // Even wider container for dashboard
                break;
        }
    } else {
        // Unauthenticated routes
        switch (view) {
            case 'register':
                CurrentContent = <RegisterView setView={setView} setIsPasswordActive={setIsPasswordActive} />;
                containerClass = "w-full max-w-sm";
                break;
            case 'login':
            default:
                CurrentContent = <LoginView setView={setView} setIsPasswordActive={setIsPasswordActive} />;
                containerClass = "w-full max-w-sm";
                break;
        }
    }


    // Determine if the content needs the special login/register wrapper style
    const needsLoginWrapper = view === 'login' || view === 'register' || !authStateReady;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 space-bg relative overflow-hidden font-inter">
            <SpaceBackgroundStyles />
            <div className="stars-container">
                <div className="star-layer star-layer-1"></div>
                <div className="star-layer star-layer-2"></div>
                <div className="star-layer star-layer-3"></div>
            </div>

            {/* Robot Peeker - ONLY visible on login/register view for password focus effect */}
            {needsLoginWrapper && (
                <RobotPeeker
                    isHiding={isPasswordActive || user}
                    authBoxPosition={authBoxPosition}
                />
            )}

            {/* Authentication/Content Box/Main Content Area */}
            <div
                ref={authBoxRef}
                className={`relative z-20 ${containerClass} transition-all duration-300 ${needsLoginWrapper
                    ? 'bg-white p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm bg-opacity-95'
                    : 'bg-transparent p-0'
                    }`}
            >
                {CurrentContent}
            </div>
        </div>
    );
};
export default App;

