import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase'; // <-- shared auth instance
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Mail, Lock, LogIn, AlertTriangle } from 'lucide-react';

const LoginView = ({ setView, setIsPasswordActive }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const isActive = password.length > 0;
        setIsPasswordActive(isActive);
    }, [password, setIsPasswordActive]);


    const handleEmailLogin = async () => {
        setAuthError(null);
        setIsSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
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
                        <p className="mt-2">to the Authorized Domains list in your Firebase Console under Authentication → Settings → Authorized Domains.</p>
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
            {/* Brand header: logo + title */}
            <div className="flex flex-col items-center space-y-4 mb-4">

                {/* Row with logo + title */}
                <div className="flex items-center space-x-3">
                    <img
                        src="/assets/logo_only.jpg"
                        alt="Paradocs AI Logo"
                        className="w-10 h-10 rounded-md shadow-md"
                    />

                    <h2 className="text-xl font-semibold text-gray-800">
                        Sign in to <span className="text-indigo-600">Paradocs AI</span>
                    </h2>
                </div>

                {/* Tagline */}
                <p className="text-gray-500 text-sm">10× your efficiency </p>

            </div>


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
export default LoginView;

