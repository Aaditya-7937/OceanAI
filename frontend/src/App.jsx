import React, { useState, useEffect, useRef } from 'react';
import {
    initializeApp
} from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { Zap, User, Lock, Mail, ChevronLeft, LogIn, UserPlus, Send, AlertTriangle, MessageSquare } from 'lucide-react';

// --- START: FIREBASE CONFIGURATION ---
// These are placeholders for local development to prevent crashing.
const LOCAL_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCoB39FMopAYi6rsEl__8Yc0Bwu9_KlcLc",
    authDomain: "ocean-44277.firebaseapp.com",
    projectId: "ocean-44277",
    storageBucket: "ocean-44277.firebasestorage.app",
    messagingSenderId: "188628002836",
    appId: "1:188628002836:web:a68c99e19b949f770edf01", // Corrected app ID placeholder
    measurementId: "G-69FYFGLW8E"
};

// Safely access global config variables
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : LOCAL_FIREBASE_CONFIG;

// Correctly using __initial_auth_token for assignment
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Set logging level to debug to see detailed Firebase activity in the console
setLogLevel('debug');

// Initialize these as null outside the component state
let firebaseApp = null;
let db = null;
let auth = null;
// --- END: FIREBASE CONFIGURATION ---

// Helper function to generate a dense, random star field using box-shadow
const generateStars = (count, sizeMultiplier, opacityBase) => {
    let shadows = [];
    const maxRange = 5000; // Define the visible star field area

    for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * maxRange) - (maxRange / 2);
        const y = Math.floor(Math.random() * maxRange) - (maxRange / 2);
        const size = Math.random() * 0.5 + 0.5; // size between 0.5 and 1.0
        const opacity = Math.random() * opacityBase + (1 - opacityBase); // varied opacity
        const color = `rgba(255, 255, 255, ${opacity.toFixed(2)})`;
        const shadow = `${x}px ${y}px 0 ${size * sizeMultiplier}px ${color}`;
        shadows.push(shadow);
    }
    return shadows.join(',\n');
};

// --- CALCULATE STAR SHADOWS ONLY ONCE ---
// This prevents the background from "popping" every time the component re-renders.
const STARS_LAYER_1_SHADOWS = generateStars(200, 1.5, 0.8);
const STARS_LAYER_2_SHADOWS = generateStars(400, 1.0, 0.6);
const STARS_LAYER_3_SHADOWS = generateStars(600, 0.8, 0.4);
// ----------------------------------------

// Custom CSS for the Space Background Animation
const SpaceBackgroundStyles = () => (
    <style>{`
        /* Keyframes for the star field movement */
        @keyframes move-stars-sm {
            from { transform: translate(0, 0); }
            to { transform: translate(-2000px, 1000px); } /* Slow diagonal movement */
        }
        @keyframes move-stars-md {
            from { transform: translate(0, 0); }
            to { transform: translate(2500px, -1500px); }
        }
        @keyframes move-stars-lg {
            from { transform: translate(0, 0); }
            to { transform: translate(-3000px, -2000px); }
        }

        .space-bg {
            background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
        }

        .stars-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: 0; /* Ensure it stays behind the content */
        }

        /* Base properties for the star pseudo-elements */
        .star-layer {
            position: absolute;
            top: 50%;
            left: 50%;
        }

        /* Star Layer 1: Closest, slightly larger, faster movement */
        .star-layer-1 {
            width: 3px;
            height: 3px;
            opacity: 0.8;
            animation: move-stars-lg 180s linear infinite; /* Very slow movement */
            transform: scale(1.5);
            box-shadow: ${STARS_LAYER_1_SHADOWS}; /* Use pre-calculated constant */
        }
        
        /* Star Layer 2: Medium size and speed */
        .star-layer-2 {
            width: 2px;
            height: 2px;
            opacity: 0.6;
            animation: move-stars-md 250s linear infinite reverse; /* Slower, reversed direction */
            box-shadow: ${STARS_LAYER_2_SHADOWS}; /* Use pre-calculated constant */
        }

        /* Star Layer 3: Farthest, smallest, slowest movement */
        .star-layer-3 {
            width: 1px;
            height: 1px;
            opacity: 0.4;
            animation: move-stars-sm 350s linear infinite; /* Extremely slow */
            box-shadow: ${STARS_LAYER_3_SHADOWS}; /* Use pre-calculated constant */
        }
    `}</style>
);


// Loading Animation Component
const AnimatedLoader = () => (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
        {/* Inline CSS for the pulse animation */}
        <style>{`
            @keyframes pulse-zap {
                0%, 100% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.8)); }
            }
            .animate-pulse-zap { animation: pulse-zap 1.5s infinite ease-in-out; }
        `}</style>
        <Zap className="w-12 h-12 text-indigo-400 animate-pulse-zap" />
        <p className="text-lg font-medium text-gray-300">Securing Session...</p>
    </div>
);

// Robot Peeker Component (SVG and Animation Logic)
const RobotPeeker = ({ isHiding, authBoxPosition, windowHeight }) => {
    const [eyeState, setEyeState] = useState({ x: 0, y: 0, isGlowing: false });
    const robotRef = useRef(null);
    const PUPIL_DISTANCE = 2;
    const GLOW_THRESHOLD_PX = 200;

    // Constants for dynamic positioning
    const ROBOT_HEIGHT = 160; // w-40 h-40 is approximately 160px
    const PEEK_OVERLAP = 20; // How many pixels of the robot's body show above the box when peeking

    // Colors for the robot's eyes
    const defaultOuterEyeColor = "#22c55e";
    const glowOuterEyeColor = "#f97316";
    const defaultPupilColor = "#166534";
    const glowPupilColor = "#7f1d1d";
    const glowShadowColor = "#ef4444";

    // Effect for handling cursor tracking and glow
    useEffect(() => {

        const handleMouseMove = (event) => {
            if (isHiding || !robotRef.current) {
                setEyeState({ x: 0, y: 0, isGlowing: false });
                return;
            }

            const rect = robotRef.current.getBoundingClientRect();
            const robotCenterX = rect.left + rect.width / 2;
            // Robot's visual center is slightly lower than the SVG's geometric center (y=40 is about 2/5ths down)
            const robotCenterY = rect.top + rect.height * 0.4;

            const dx_screen = event.clientX - robotCenterX;
            const dy_screen = event.clientY - robotCenterY;

            // Pupil tracking calculation (SVG units)
            const angle = Math.atan2(dy_screen, dx_screen);
            const offsetX = PUPIL_DISTANCE * Math.cos(angle);
            const offsetY = PUPIL_DISTANCE * Math.sin(angle);

            // Glow calculation based on screen distance
            const distance = Math.sqrt(dx_screen * dx_screen + dy_screen * dy_screen);
            const normalizedDistance = Math.min(1, distance / GLOW_THRESHOLD_PX);
            const glowIntensity = 1 - normalizedDistance;
            const isGlowing = glowIntensity > 0.1;

            setEyeState({
                x: offsetX,
                y: offsetY,
                isGlowing: isGlowing
            });
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isHiding]);

    // Dynamic styling calculation
    const currentOuterEyeColor = eyeState.isGlowing ? glowOuterEyeColor : defaultOuterEyeColor;
    const currentPupilColor = eyeState.isGlowing ? glowPupilColor : defaultPupilColor;
    const filterStyle = eyeState.isGlowing
        ? `drop-shadow(0 0 5px ${glowShadowColor}) drop-shadow(0 0 10px ${glowShadowColor}77)`
        : 'none';


    // DYNAMIC POSITIONING LOGIC
    // 1. Position when peeking (showing PEEK_OVERLAP pixels above the box)
    // The robot's top edge position: BoxTop - (TotalHeight - Overlap)
    const peekingTop = authBoxPosition.top - (ROBOT_HEIGHT - PEEK_OVERLAP);

    // 2. Position when hiding (top edge aligned with the box's top edge)
    // This fully covers the robot without sending it off-screen.
    const hidingTop = authBoxPosition.top;

    // 3. Set the final CSS 'top' value based on state.
    const currentTop = isHiding ? hidingTop : peekingTop;

    // Arm colors
    const ARM_COLOR = "#a0a3a7";
    const JOINT_COLOR = "#717a87";
    const FINGER_COLOR = "#90ee90";

    // Adjusted arm start points to connect to the body
    const LEFT_ARM_START_X = 25; // Aligned with the left side of the body rect (x="25")
    const LEFT_ARM_START_Y = 60; // Vertical position on the body
    const RIGHT_ARM_START_X = 75; // Aligned with the right side of the body rect (x="75")
    const RIGHT_ARM_START_Y = 60;
    const ARM_ROTATION = 35; // Increased rotation for "flared out" look

    // Hand/Finger definitions (simplified articulated look based on the drawing)
    const renderHand = (x, y, scaleX) => (
        <g transform={`translate(${x} ${y}) scale(${scaleX} 1)`}>
            {/* Wrist/Palm block */}
            <rect x="-8" y="-10" width="16" height="15" rx="3" fill={ARM_COLOR} />

            {/* Fingers (3 fingers visible) */}
            <rect x="-8" y="5" width="4" height="8" rx="1" fill={FINGER_COLOR} />
            <rect x="-2" y="5" width="4" height="8" rx="1" fill={FINGER_COLOR} />
            <rect x="4" y="5" width="4" height="8" rx="1" fill={FINGER_COLOR} />
        </g>
    );


    // Arm segment definitions (modular look)
    const renderArm = (isLeft) => {
        // These coordinates are relative to the SVG viewbox (0-100) and place the shoulder joint
        // at the side of the robot's main body.
        const x = isLeft ? LEFT_ARM_START_X : RIGHT_ARM_START_X;
        const y = isLeft ? LEFT_ARM_START_Y : RIGHT_ARM_START_Y;
        const rotation = isLeft ? -ARM_ROTATION : ARM_ROTATION; // Inward/Outward slant

        return (
            // Group for the entire arm, translated to the shoulder point and rotated
            <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
                {/* Shoulder joint cover */}
                <circle cx="0" cy="0" r="4" fill={JOINT_COLOR} />

                {/* 1. Upper Arm Block (starts below the joint) */}
                <rect x="-3" y="2" width="6" height="15" rx="2" fill={ARM_COLOR} />
                {/* 1a. Inner Detail (Recessed panel) */}
                <rect x="-1" y="5" width="2" height="9" rx="1" fill="#c0c0c0" />

                {/* 2. Elbow Joint */}
                <circle cx="0" cy="17" r="5" fill={JOINT_COLOR} />

                {/* 3. Forearm Block (shorter for peeking view, starts below elbow) */}
                <rect x="-3" y="22" width="6" height="10" rx="2" fill={ARM_COLOR} />

                {/* 4. Wrist Joint (Connects to Hand) */}
                <circle cx="0" cy="32" r="3" fill={JOINT_COLOR} />

                {/* 5. Hand (needs opposite rotation to look natural) */}
                <g transform={`rotate(${-rotation}) translate(0 42)`}>
                    {renderHand(0, 0, isLeft ? 1 : -1)}
                </g>
            </g>
        );
    }


    return (
        <div
            className={`absolute z-10 w-full h-full flex items-center justify-center pointer-events-none`}
            style={{ top: '0', left: '0' }}
        >
            <svg
                ref={robotRef}
                className={`absolute w-40 h-40 transform transition-all duration-500 ease-in-out drop-shadow-lg`}
                style={{
                    filter: filterStyle,
                    left: '50%',
                    top: `${currentTop}px`, // Dynamic vertical position
                    // Only horizontal center translate is needed
                    transform: 'translateX(-50%)',
                    // Add a bouncy effect to the vertical transition
                    transition: 'top 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), filter 0.2s',
                }}
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Robot Body */}
                <path d="M40 98 L50 90 L60 98 C55 105, 45 105, 40 98 Z" fill="#facc15" opacity="0.8" />
                <rect x="25" y="40" width="50" height="60" rx="20" fill="#f0f0f0" stroke="#ccc" strokeWidth="2" />
                <circle cx="50" cy="40" r="25" fill="#e0ffe0" stroke="#ccc" strokeWidth="2" />
                <circle cx="50" cy="40" r="20" fill="#ffffff" />

                {/* Eyes */}
                <circle cx="40" cy="40" r="5" fill={currentOuterEyeColor} />
                <circle cx="60" cy="40" r="5" fill={currentOuterEyeColor} />

                {/* Pupils (Tracking) */}
                <circle cx={40 + eyeState.x} cy={40 + eyeState.y} r="3" fill={currentPupilColor} />
                <circle cx={60 + eyeState.x} cy={40 + eyeState.y} r="3" fill={currentPupilColor} />

                {/* Antennae */}
                <line x1="38" y1="20" x2="38" y2="10" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
                <circle cx="38" cy="10" r="3" fill="#16a34a" />
                <line x1="62" y1="20" x2="62" y2="10" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
                <circle cx="62" cy="10" r="3" fill="#16a34a" />

                {/* Articulated Arms */}
                {renderArm(true)}  {/* Left Arm */}
                {renderArm(false)} {/* Right Arm */}

            </svg>
        </div>
    );
};

// --- LOGIN VIEW COMPONENT ---
const LoginView = ({ setView, setIsPasswordActive }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Hide robot ONLY if password is being typed
    useEffect(() => {
        const isActive = password.length > 0;
        setIsPasswordActive(isActive);
    }, [password, setIsPasswordActive]);


    const handleEmailLogin = async () => {
        setAuthError(null);
        setIsSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Success handled by onAuthStateChanged listener in App component
        } catch (error) {
            console.error("Login Error:", error.code, error.message);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setAuthError("User with given credentials do not exist in database, try registering instead.");
            } else if (error.code === 'auth/invalid-email') {
                setAuthError("Please enter a valid email address.");
            } else {
                setAuthError("Login failed. Please check your credentials.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setAuthError(null);
        setIsSubmitting(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google Login Error:", error.code, error.message);

            let displayError = "Google Sign-In failed. Please try again.";

            if (error.code === 'auth/unauthorized-domain') {
                displayError = (
                    <div>
                        <p className="font-bold mb-2">Google Sign-In Setup Required!</p>
                        <p>To enable Google login, you must add the current domain:</p>
                        <p className="font-mono text-xs bg-red-200 p-1 rounded mt-1 break-all">
                            {window.location.host}
                        </p>
                        <p className="mt-2">to the **Authorized Domains** list in your Firebase Console under Authentication &gt; Settings &gt; Authorized Domains.</p>
                    </div>
                );
            } else if (error.code === 'auth/popup-closed-by-user') {
                displayError = "Sign-in window closed. Please try again.";
            }

            setAuthError(displayError);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Sign In to Continue</h2>

            {authError && (
                <div className="flex items-start p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-sm">{typeof authError === 'string' ? authError : authError}</span>
                </div>
            )}

            <div className="space-y-4">
                {/* Email Input */}
                <div className="relative">
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150"
                        disabled={isSubmitting}
                    />
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                {/* Password Input */}
                <div className="relative">
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEmailLogin();
                        }}
                        disabled={isSubmitting}
                    />
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>

            <button
                className="w-full py-3 flex items-center justify-center space-x-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition duration-150 active:scale-[.98] disabled:opacity-50"
                onClick={handleEmailLogin}
                disabled={isSubmitting || !email || !password}
            >
                <LogIn className="w-5 h-5" />
                {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="text-center text-sm text-gray-500">
                — OR —
            </div>

            {/* Google Login Button */}
            <button
                className="w-full py-3 flex items-center justify-center space-x-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl shadow-md hover:bg-gray-50 transition duration-150 active:scale-[.98] disabled:opacity-50"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
            >
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/2000px-Google_%22G%22_logo.svg.png" alt="Google logo" className="w-5 h-5" />
                {isSubmitting ? 'Connecting...' : 'Sign In with Google'}
            </button>

            <p className="text-center text-sm text-gray-600 pt-2">
                Don't have an account?{' '}
                <button
                    onClick={() => setView('register')}
                    className="text-indigo-600 font-semibold hover:text-indigo-800 transition duration-150 active:scale-[.98]"
                >
                    Register here.
                </button>
            </p>
        </div>
    );
};

// --- REGISTER VIEW COMPONENT ---
const RegisterView = ({ setView, setIsPasswordActive }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordsMatch = password === confirmPassword && password.length > 0;

    // Hide robot ONLY if password or confirm password is being typed
    useEffect(() => {
        const isActive = password.length > 0 || confirmPassword.length > 0;
        setIsPasswordActive(isActive);
    }, [password, confirmPassword, setIsPasswordActive]);

    const handleRegister = async () => {
        setAuthError(null);

        if (!passwordsMatch) {
            setAuthError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setAuthError("Password must be at least 6 characters long.");
            return;
        }

        setIsSubmitting(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // Success: User is automatically signed in, and App's onAuthStateChanged handles navigation.
        } catch (error) {
            console.error("Registration Error:", error.code, error.message);
            if (error.code === 'auth/email-already-in-use') {
                setAuthError("This email address is already registered. Try logging in.");
            } else if (error.code === 'auth/invalid-email') {
                setAuthError("Please enter a valid email address.");
            } else {
                setAuthError(`Registration failed: ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <button
                onClick={() => setView('login')}
                className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 transition duration-150 mb-4 active:scale-[.98]"
            >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Sign In
            </button>

            <h2 className="text-xl font-semibold text-gray-800">Create New Account</h2>

            {authError && (
                <div className="flex items-start p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-sm">{authError}</span>
                </div>
            )}

            <div className="space-y-4">
                {/* Email Input */}
                <div className="relative">
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150"
                        disabled={isSubmitting}
                    />
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                {/* Password Input */}
                <div className="relative">
                    <input
                        type="password"
                        placeholder="Create New Password (min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full p-3 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition duration-150 ${password.length > 0 && !passwordsMatch ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'
                            }`}
                        disabled={isSubmitting}
                    />
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                {/* Confirm Password Input */}
                <div className="relative">
                    <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full p-3 pl-10 border rounded-xl focus:outline-none focus:ring-2 transition duration-150 ${confirmPassword.length > 0 && !passwordsMatch ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'
                            }`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRegister();
                        }}
                        disabled={isSubmitting}
                    />
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>

            <button
                className="w-full py-3 flex items-center justify-center space-x-2 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition duration-150 active:scale-[.98] disabled:opacity-50"
                onClick={handleRegister}
                disabled={isSubmitting || !email || !password || !confirmPassword || !passwordsMatch || password.length < 6}
            >
                <UserPlus className="w-5 h-5" />
                {isSubmitting ? 'Registering...' : 'Register and Sign In'}
            </button>
        </div>
    );
};

// --- AUTHENTICATED CHAT VIEW ---
const AuthenticatedApp = ({ userId, displayName, onSignOut }) => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                <span>Welcome, {displayName || 'User'}!</span>
            </h2>
            <div className="bg-green-100 p-4 rounded-xl border border-green-400">
                <p className="text-green-700 font-medium">You are now securely logged in.</p>
                <p className="font-mono text-xs text-gray-800 break-all flex items-center mt-2">
                    <User className="inline-block w-4 h-4 mr-2 text-green-500" />
                    User ID: <span className="font-bold text-green-700 ml-1">{userId}</span>
                </p>
            </div>

            <p className="text-gray-600">This is where your secure LLM Assistant application content would reside.</p>

            <button
                className="w-full py-3 flex items-center justify-center space-x-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition duration-150 active:scale-[.98]"
                onClick={onSignOut}
            >
                <LogIn className="w-5 h-5 rotate-180" />
                Sign Out
            </button>
        </div>
    );
};


// Main App Component (Default Export)
const App = () => {
    const authBoxRef = useRef(null);
    const [user, setUser] = useState(null); // Firebase User object
    const [authStateReady, setAuthStateReady] = useState(false);
    const [view, setView] = useState('login'); // 'login', 'register', 'chat' (handled by user state)
    const [isPasswordActive, setIsPasswordActive] = useState(false);
    const [authBoxPosition, setAuthBoxPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

    // 1. Firebase Initialization and Auth Logic
    useEffect(() => {
        firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);

        // A. Handle custom token sign-in (if available) or anonymous sign-in
        const initialAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Initial authentication failed:", error);
            }
        };

        // B. Listen for auth state changes
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!authStateReady) {
                setAuthStateReady(true);
            }
            if (currentUser) {
                // If user logs in, ensure the view is reset/appropriate
                setView('login');
            }
        });

        initialAuth();

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, []);

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

        // Recalculate position whenever the view changes (e.g., login to register form length changes)
        if (authBoxRef.current) {
            const observer = new MutationObserver(updatePosition);
            observer.observe(authBoxRef.current, { childList: true, subtree: true, attributes: true });
            return () => {
                window.removeEventListener('resize', updatePosition);
                observer.disconnect();
            };
        } else {
            // Fallback cleanup if ref is null initially
            return () => window.removeEventListener('resize', updatePosition);
        }

    }, [view, authStateReady]); // Depend on view/authStateReady to re-measure

    // 3. Sign Out Handler
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setUser(null); // Explicitly clear user state
            setView('login');
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };

    // 4. Determine Current Content Component
    let CurrentContent;
    if (user) {
        CurrentContent = (
            <AuthenticatedApp
                userId={user.uid}
                displayName={user.displayName || user.email}
                onSignOut={handleSignOut}
            />
        );
    } else {
        switch (view) {
            case 'register':
                CurrentContent = <RegisterView setView={setView} setIsPasswordActive={setIsPasswordActive} />;
                break;
            case 'login':
            default:
                CurrentContent = <LoginView setView={setView} setIsPasswordActive={setIsPasswordActive} />;
                break;
        }
    }

    // 5. Render
    if (!authStateReady) {
        return (
            <div className="min-h-screen flex items-center justify-center space-bg">
                <SpaceBackgroundStyles />
                <div className="stars-container">
                    <div className="star-layer star-layer-1"></div>
                    <div className="star-layer star-layer-2"></div>
                    <div className="star-layer star-layer-3"></div>
                </div>
                <AnimatedLoader />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 space-bg relative overflow-hidden font-inter">
            <SpaceBackgroundStyles />
            <div className="stars-container">
                <div className="star-layer star-layer-1"></div>
                <div className="star-layer star-layer-2"></div>
                <div className="star-layer star-layer-3"></div>
            </div>

            {/* Robot Peeker (Always rendered, hidden behind the box when active) */}
            <RobotPeeker
                isHiding={isPasswordActive || user} // Hide if password field is active OR if user is already logged in (no need to peek)
                authBoxPosition={authBoxPosition}
                windowHeight={window.innerHeight}
            />

            {/* Authentication/Content Box */}
            <div
                ref={authBoxRef}
                className="relative z-20 w-full max-w-sm bg-white p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm bg-opacity-95"
            >
                {CurrentContent}
            </div>
        </div>
    );
};
export default App;