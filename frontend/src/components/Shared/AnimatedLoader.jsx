import React from 'react';
import { Loader2 } from 'lucide-react';
// AnimatedLoader Component (src/components/Shared/AnimatedLoader.jsx)
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
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        <p className="text-lg font-medium text-gray-300">Securing Session...</p>
    </div>
);
export default AnimatedLoader;