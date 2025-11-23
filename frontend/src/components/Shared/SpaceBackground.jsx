import React from 'react';

/**
 * Renders the structural divs for the animated star background.
 * Assumes the global CSS classes (space-bg, stars-container, star-layer-X)
 * are injected by SpaceBackgroundStyles.jsx in the root App component.
 */
const SpaceBackground = () => {
    return (
        <div className="space-bg">
            <div className="stars-container">
                {/* Order matters for z-index effect, layer 1 is typically closest */}
                <div className="star-layer star-layer-3"></div>
                <div className="star-layer star-layer-2"></div>
                <div className="star-layer star-layer-1"></div>
            </div>
        </div>
    );
};

export default SpaceBackground;