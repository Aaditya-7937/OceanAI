import React, { useState, useEffect, useRef } from 'react';

/**
 * RobotPeeker Component
 * Displays an animated robot character using SVG, which peeks over the top of
 * an element (like an authentication box) and tracks the user's mouse cursor
 * with its eyes. Its eyes glow when the cursor is close to the center of the robot.
 *
 * @param {boolean} isHiding - True if the robot should be hiding behind the element.
 * @param {object} authBoxPosition - An object {top: number} representing the Y position of the element to peek over.
 */
const RobotPeeker = ({ isHiding, authBoxPosition }) => {
    // State for eye position and glow effect
    const [eyeState, setEyeState] = useState({ x: 0, y: 0, isGlowing: false });
    // Ref to get the robot's SVG position in the DOM
    const robotRef = useRef(null);

    // --- Constants for Physics and Design ---
    const PUPIL_DISTANCE = 2; // Max distance the pupil can move within the eye socket
    const GLOW_THRESHOLD_PX = 200; // Mouse distance in pixels to trigger max glow

    const ROBOT_HEIGHT = 160; // Approximate height of the SVG viewbox in pixels on screen (w-40 h-40)
    const PEEK_OVERLAP = 20; // How much of the robot body is visible when peeking

    const defaultOuterEyeColor = "#22c55e"; // Green-500
    const glowOuterEyeColor = "#f97316";   // Orange-500
    const defaultPupilColor = "#166534";   // Green-800
    const glowPupilColor = "#7f1d1d";      // Red-800
    const glowShadowColor = "#ef4444";     // Red-500

    const ARM_COLOR = "#a0a3a7";
    const JOINT_COLOR = "#717a87";
    const FINGER_COLOR = "#90ee90";

    const LEFT_ARM_START_X = 25;
    const LEFT_ARM_START_Y = 60;
    const RIGHT_ARM_START_X = 75;
    const RIGHT_ARM_START_Y = 60;
    const ARM_ROTATION = 35;


    // --- Effect for Mouse Tracking ---
    useEffect(() => {
        const handleMouseMove = (event) => {
            if (isHiding || !robotRef.current) {
                // Reset eye state if hiding or if the ref is not attached
                setEyeState({ x: 0, y: 0, isGlowing: false });
                return;
            }

            const rect = robotRef.current.getBoundingClientRect();
            // Calculate the central point of the robot's head (where eyes are)
            const robotCenterX = rect.left + rect.width / 2;
            const robotCenterY = rect.top + rect.height * 0.4;

            // Distance vector from robot center to mouse cursor
            const dx_screen = event.clientX - robotCenterX;
            const dy_screen = event.clientY - robotCenterY;

            // Calculate the angle to determine eye direction
            const angle = Math.atan2(dy_screen, dx_screen);
            const offsetX = PUPIL_DISTANCE * Math.cos(angle);
            const offsetY = PUPIL_DISTANCE * Math.sin(angle);

            // Calculate overall distance for glow effect
            const distance = Math.sqrt(dx_screen * dx_screen + dy_screen * dy_screen);
            // Normalize distance: 0 (close) to 1 (far)
            const normalizedDistance = Math.min(1, distance / GLOW_THRESHOLD_PX);
            // Invert the normalized distance for glowing (closer = more glow)
            const isGlowing = (1 - normalizedDistance) > 0.3; // 30% closeness threshold

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

    // --- Dynamic Styles ---
    const currentOuterEyeColor = eyeState.isGlowing ? glowOuterEyeColor : defaultOuterEyeColor;
    const currentPupilColor = eyeState.isGlowing ? glowPupilColor : defaultPupilColor;

    // Apply SVG filter for glowing effect
    const filterStyle = eyeState.isGlowing
        ? `drop-shadow(0 0 5px ${glowShadowColor}) drop-shadow(0 0 10px ${glowShadowColor}77)`
        : 'none';

    // Calculate vertical position for peek/hide animation
    const peekingTop = authBoxPosition.top - (ROBOT_HEIGHT - PEEK_OVERLAP);
    const hidingTop = authBoxPosition.top;
    const currentTop = isHiding ? hidingTop : peekingTop;

    // --- SVG Helper Functions ---

    /** Renders a stylized robot hand. */
    const renderHand = (x, y, scaleX) => (
        <g transform={`translate(${x} ${y}) scale(${scaleX} 1)`}>
            {/* Palm */}
            <rect x="-8" y="-10" width="16" height="15" rx="3" fill={ARM_COLOR} />
            {/* Fingers (stylized green tips) */}
            <rect x="-8" y="5" width="4" height="8" rx="1" fill={FINGER_COLOR} />
            <rect x="-2" y="5" width="4" height="8" rx="1" fill={FINGER_COLOR} />
            <rect x="4" y="5" width="4" height="8" rx="1" fill={FINGER_COLOR} />
        </g>
    );

    /** Renders a complete articulated arm. */
    const renderArm = (isLeft) => {
        const x = isLeft ? LEFT_ARM_START_X : RIGHT_ARM_START_X;
        const y = isLeft ? LEFT_ARM_START_Y : RIGHT_ARM_START_Y;
        const rotation = isLeft ? -ARM_ROTATION : ARM_ROTATION;

        return (
            // Arm translation and initial rotation
            <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
                {/* Shoulder joint */}
                <circle cx="0" cy="0" r="4" fill={JOINT_COLOR} />
                {/* Upper arm segment */}
                <rect x="-3" y="2" width="6" height="15" rx="2" fill={ARM_COLOR} />
                <rect x="-1" y="5" width="2" height="9" rx="1" fill="#c0c0c0" /> {/* Inner detail */}
                {/* Elbow joint */}
                <circle cx="0" cy="17" r="5" fill={JOINT_COLOR} />
                {/* Lower arm segment */}
                <rect x="-3" y="22" width="6" height="10" rx="2" fill={ARM_COLOR} />
                {/* Wrist joint */}
                <circle cx="0" cy="32" r="3" fill={JOINT_COLOR} />

                {/* Hand group: Counter-rotate and translate to position the hand correctly */}
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
                    top: `${currentTop}px`, // Controlled by the peek/hide logic
                    transform: 'translateX(-50%)',
                    // Smoother transition for the peek/hide movement
                    transition: 'top 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), filter 0.2s',
                }}
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* --- Robot Structure --- */}

                {/* Feet/Base (subtle yellow base) */}
                <path d="M40 98 L50 90 L60 98 C55 105, 45 105, 40 98 Z" fill="#facc15" opacity="0.8" />

                {/* Main Body */}
                <rect x="25" y="40" width="50" height="60" rx="20" fill="#f0f0f0" stroke="#ccc" strokeWidth="2" />

                {/* Head (Outer) */}
                <circle cx="50" cy="40" r="25" fill="#e0ffe0" stroke="#ccc" strokeWidth="2" />
                {/* Head (Inner) */}
                <circle cx="50" cy="40" r="20" fill="#ffffff" />

                {/* --- Eyes (Dynamic) --- */}
                <circle cx="40" cy="40" r="5" fill={currentOuterEyeColor} />
                <circle cx="60" cy="40" r="5" fill={currentOuterEyeColor} />

                {/* Pupils (Tracking) */}
                <circle cx={40 + eyeState.x} cy={40 + eyeState.y} r="3" fill={currentPupilColor} />
                <circle cx={60 + eyeState.x} cy={40 + eyeState.y} r="3" fill={currentPupilColor} />

                {/* --- Antennae --- */}
                <line x1="38" y1="20" x2="38" y2="10" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
                <circle cx="38" cy="10" r="3" fill="#16a34a" />
                <line x1="62" y1="20" x2="62" y2="10" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
                <circle cx="62" cy="10" r="3" fill="#16a34a" />

                {/* --- Articulated Arms --- */}
                {renderArm(true)}
                {renderArm(false)}

            </svg>
        </div>
    );
};
export default RobotPeeker;