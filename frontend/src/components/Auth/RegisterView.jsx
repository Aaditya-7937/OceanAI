import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase'; // <-- shared auth instance
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { Mail, Lock, AlertTriangle, ChevronLeft, UserPlus } from 'lucide-react';

const RegisterView = ({ setView, setIsPasswordActive }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordsMatch = password === confirmPassword && password.length > 0;

    useEffect(() => {
        const isActive = password.length > 0 || confirmPassword.length > 0;
        setIsPasswordActive(isActive);
    }, [password, confirmPassword, setIsPasswordActive]);

    // Action code settings for the verification link.
    // The logoPath query param points to the generated logo file you uploaded.
    // Path used (local generated file): /mnt/data/A_digital_vector_graphic_features_the_Paradocs_AI_.png
    const actionCodeSettings = {
        url: `${window.location.origin}/verify-email?logoPath=${encodeURIComponent('/mnt/data/A_digital_vector_graphic_features_the_Paradocs_AI_.png')}`,
        handleCodeInApp: true,
    };

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
            // create the user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // send verification email that redirects back to /verify-email with logoPath param
            await sendEmailVerification(user, actionCodeSettings);

            // sign user out to prevent access until they verify
            await signOut(auth);

            // show friendly message instructing the user to check email
            setAuthError(`Verification email sent to ${email}. Please open the link in your email to verify your account before signing in.`);

            // optionally move them back to the login view
            setView('login');
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

            {/* Logo + Title */}
            <div className="flex flex-col items-center space-y-4 mb-2">
                <div className="flex items-center space-x-3">
                    <img
                        src="/assets/paradocs.png"
                        alt="Paradocs AI Logo"
                        className="w-10 h-10 rounded-md shadow-md"
                    />

                    <h2 className="text-xl font-semibold text-gray-800">
                        Welcome to <span className="text-indigo-600">Paradocs AI</span>
                    </h2>
                </div>

                <p className="text-gray-500 text-sm">Create your account</p>
            </div>

            {authError && (
                <div className="flex flex-col items-start p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <span className="ml-3 text-sm">{authError}</span>
                    </div>

                    {/* If verification mail was sent, show a small helper row with a 'Resend' option */}
                    {typeof authError === 'string' && authError.includes('Verification email sent') && (
                        <div className="mt-3 text-sm">
                            <button
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    try {
                                        // firebase requires a signed-in user to resend the email.
                                        // we will attempt to re-sign-in briefly using the provided credentials (this is optional
                                        // and will fail if the user hasn't completed sign-in yet). Best practice is to prompt
                                        // them to sign in and then resend. Here we'll handle gracefully.
                                        if (!auth.currentUser) {
                                            setAuthError('Please sign in to resend the verification email.');
                                        } else {
                                            await sendEmailVerification(auth.currentUser, actionCodeSettings);
                                            setAuthError(`Verification email resent to ${auth.currentUser.email}.`);
                                        }
                                    } catch (err) {
                                        console.error('Resend failed', err);
                                        setAuthError('Could not resend verification email. Try again later.');
                                    } finally {
                                        setIsSubmitting(false);
                                    }
                                }}
                                className="text-indigo-600 underline"
                            >
                                Resend verification email
                            </button>
                        </div>
                    )}
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

export default RegisterView;
