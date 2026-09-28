import React from 'react';
import './FeedSwipeContainer.css';

/**
 * Wraps the home feed and plays the drop-out / drop-in animation when a feed
 * is confirmed from the top feed strip. `phase` is 'out' | 'in' | null.
 */
function FeedSwipeContainer({ phase, children }) {
  return (
    <div className={`feed-swipe-container${phase ? ` feed-swipe-${phase}` : ''}`}>
      {children}
    </div>
  );
}

export default FeedSwipeContainer;
