// src/components/Auth/VerifyEmail.jsx
import React, { useEffect, useState } from 'react';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../../firebase';
import { useLocation, useNavigate } from 'react-router-dom'; // if using react-router

function useQuery() {
    return new URLSearchParams(window.location.search);
}

const VerifyEmail = () => {
    const [status, setStatus] = useState('verifying'); // verifying | success | error
    const q = useQuery();
    const navigate = useNavigate ? useNavigate() : null;

    useEffect(() => {
        (async () => {
            const oobCode = q.get('oobCode') || q.get('oobcode') || new URLSearchParams(window.location.search).get('oobCode');
            if (!oobCode) {
                setStatus('error');
                return;
            }

            try {
                await applyActionCode(auth, oobCode);
                setStatus('success');
                // Optionally, redirect to login after a short delay
                setTimeout(() => {
                    if (navigate) navigate('/');
                    else window.location.href = '/';
                }, 2500);
            } catch (err) {
                console.error('Email verification failed', err);
                setStatus('error');
            }
        })();
    }, []);

    if (status === 'verifying') return <div>Verifying your email...</div>;
    if (status === 'success') return <div>Email verified! Redirecting you to the sign in page…</div>;
    return <div>Verification failed or link expired. Try requesting a new verification email.</div>;
};

export default VerifyEmail;
