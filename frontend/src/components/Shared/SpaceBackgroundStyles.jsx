import React from 'react';

// --- Star Field Generation Logic ---

/**
 * Helper function to generate a dense, random star field using box-shadow.
 * Generates N stars across a large virtual space, optimized for parallax effect.
 * @param {number} count The number of stars to generate.
 * @param {number} sizeMultiplier Factor to multiply the base random size by.
 * @param {number} opacityBase The minimum base opacity for the stars.
 * @returns {string} A comma-separated string of box-shadow values.
 */
const generateStars = (count, sizeMultiplier, opacityBase) => {
    let shadows = [];
    // Define a large range for the stars to spread out over
    const maxRange = 5000;
    for (let i = 0; i < count; i++) {
        // Random position within the range
        const x = Math.floor(Math.random() * maxRange) - (maxRange / 2);
        const y = Math.floor(Math.random() * maxRange) - (maxRange / 2);

        // Random size (0.5 to 1.5)
        const size = Math.random() * 0.5 + 0.5;

        // Random opacity based on the layer's base
        const opacity = Math.random() * opacityBase + (1 - opacityBase);
        const color = `rgba(255, 255, 255, ${opacity.toFixed(2)})`;

        // The box-shadow format: X Y Blur Spread Color
        const shadow = `${x}px ${y}px 0 ${size * sizeMultiplier}px ${color}`;
        shadows.push(shadow);
    }
    return shadows.join(',\n');
};

// Generate the star shadows once to keep the stars static between renders
// Using useMemo is cleaner here, but since this is outside the component, it acts like a static memoized value.
const STARS_LAYER_1_SHADOWS = generateStars(200, 1.5, 0.8); // Closest, biggest
const STARS_LAYER_2_SHADOWS = generateStars(400, 1.0, 0.6); // Middle
const STARS_LAYER_3_SHADOWS = generateStars(600, 0.8, 0.4); // Farthest, smallest


/**
 * Renders an inline <style> tag containing all the CSS necessary for the
 * animated star background, including keyframes and generated box-shadows.
 * This should be imported once, typically in the main App component.
 */
const SpaceBackgroundStyles = () => (
    <style>{`
        /* Keyframes for the star field movement (Parallax Effect) */
        @keyframes move-stars-sm {
            from { transform: translate(0, 0); }
            /* Slow, small movement */
            to { transform: translate(-1500px, 750px); }
        }
        @keyframes move-stars-md {
            from { transform: translate(0, 0); }
            /* Medium speed movement */
            to { transform: translate(2000px, -1250px); }
        }
        @keyframes move-stars-lg {
            from { transform: translate(0, 0); }
            /* Fastest, largest movement */
            to { transform: translate(-3000px, -2000px); }
        }

        /* Container and Background */
        .space-bg {
            /* Deep space radial gradient */
            background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
            position: fixed; /* Use fixed for full viewport coverage */
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: -10; /* Ensure it stays behind content */
        }

        /* Main wrapper for the parallax layers */
        .stars-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }

        /* Base properties for the star elements */
        .star-layer {
            /* Place the star generation point (0,0) at the center of the viewport */
            position: absolute;
            top: 50%;
            left: 50%;
            /* Reset content and display */
            content: ''; 
            display: block; 
            box-shadow: none; /* Base element itself is invisible */
        }

        /* Star Layer 1: Closest, slightly larger, faster movement */
        .star-layer-1 {
            width: 3px;
            height: 3px;
            opacity: 0.8;
            /* Faster animation, larger spread */
            animation: move-stars-lg 180s linear infinite; 
            box-shadow: ${STARS_LAYER_1_SHADOWS};
        }

        /* Star Layer 2: Medium size and speed */
        .star-layer-2 {
            width: 2px;
            height: 2px;
            opacity: 0.6;
            /* Medium animation speed, reversed direction for better parallax */
            animation: move-stars-md 250s linear infinite reverse;
            box-shadow: ${STARS_LAYER_2_SHADOWS};
        }

        /* Star Layer 3: Farthest, smallest, slowest movement */
        .star-layer-3 {
            width: 1px;
            height: 1px;
            opacity: 0.4;
            /* Slowest animation */
            animation: move-stars-sm 350s linear infinite;
            box-shadow: ${STARS_LAYER_3_SHADOWS};
        }
    `}</style>
);

export default SpaceBackgroundStyles;