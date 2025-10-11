import React, { useState, useEffect, useRef } from 'react';
import './TopTabs.css';

const TopTabs = ({ activeFilter, onFilterChange, showFilterButton = false, onFilterClick, isFilterActive = false, onActiveTabClick, hasCustomFilters = false }) => {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const containerRef = useRef(null);

  const tabs = [
    { id: 'trending', label: 'Trending', icon: 'fire' },
    { id: 'new', label: 'New', icon: 'sparkles' },
    { id: 'graduating', label: 'Graduating', icon: 'graduation-cap' },
    { id: 'custom', label: 'Custom', icon: 'filter' }
  ];

  const currentIndex = tabs.findIndex(tab => tab.id === activeFilter);

  // Icon component renderer
  const renderIcon = (iconName, isActive = false) => {
    const iconProps = {
      width: 16, // Reduced from 20 to 16 for smaller icons
      height: 16, // Reduced from 20 to 16 for smaller icons
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    };

    switch (iconName) {
      case 'sparkles':
        return (
          <svg {...iconProps}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            <path d="M5 3v4"/>
            <path d="M19 17v4"/>
            <path d="M3 5h4"/>
            <path d="M17 19h4"/>
          </svg>
        );
      case 'graduation-cap':
        return (
          <svg {...iconProps}>
            <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
            <path d="M22 10v6"/>
            <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
          </svg>
        );
      case 'fire':
        return (
          <svg {...iconProps}>
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        );
      case 'trending-up':
        return (
          <svg {...iconProps}>
            <polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/>
            <polyline points="16,7 22,7 22,13"/>
          </svg>
        );
      case 'zap':
        return (
          <svg {...iconProps}>
            <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
          </svg>
        );
      case 'star':
        return (
          <svg {...iconProps}>
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/>
          </svg>
        );
      case 'filter':
        return (
          <svg {...iconProps}>
            <path d="M3 4.5H21V6H3V4.5ZM6 10.5H18V12H6V10.5ZM9 16.5H15V18H9V16.5Z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  // Create reordered tabs array with active tab in center
  const getReorderedTabs = () => {
    const activeIndex = tabs.findIndex(tab => tab.id === activeFilter);
    if (activeIndex === -1) return tabs;

    // Create a new array with the active tab in the center (index 1)
    const reordered = [];
    const totalTabs = tabs.length;
    
    // Previous tab (left)
    const prevIndex = (activeIndex - 1 + totalTabs) % totalTabs;
    reordered.push({ ...tabs[prevIndex], position: 'left' });
    
    // Active tab (center)
    reordered.push({ ...tabs[activeIndex], position: 'center' });
    
    // Next tab (right)
    const nextIndex = (activeIndex + 1) % totalTabs;
    reordered.push({ ...tabs[nextIndex], position: 'right' });
    
    return reordered;
  };

  const reorderedTabs = getReorderedTabs();

  // Handle touch events for swipe functionality
  const handleTouchStart = (e) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    // Handle swipe functionality for navigation between tabs
    const minSwipeDistance = 50;
    const distance = touchStartX - touchEndX;
    
    if (Math.abs(distance) > minSwipeDistance) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeFilter);
      const targetIndex = distance > 0 ? currentIndex + 1 : currentIndex - 1;
      
      // Allow swiping to trending, new, and custom tabs
      if (targetIndex >= 0 && targetIndex < tabs.length && 
          (tabs[targetIndex].id === 'trending' || tabs[targetIndex].id === 'new' || tabs[targetIndex].id === 'custom')) {
        onFilterChange({ type: tabs[targetIndex].id });
      }
    }
    
    setTouchStartX(0);
    setTouchEndX(0);
  };

  // Add touch listeners to the entire viewport for global swipe detection
  useEffect(() => {
    let swipeStartX = 0;
    let swipeStartY = 0;
    let isSwiping = false;
    let isVerticalScroll = false;
    
    const handleGlobalTouchStart = (e) => {
      // Don't process swipes if touch started on a button/interactive element
      const target = e.target;
      if (target.closest('button') || target.closest('a') || target.closest('input')) {
        return;
      }
      
      // Only listen for swipes at the top 30% of the screen (near tabs)
      const touchY = e.touches[0].clientY;
      const screenHeight = window.innerHeight;
      if (touchY > screenHeight * 0.3) {
        return; // Ignore touches below top 30% of screen
      }
      
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      isSwiping = false;
      isVerticalScroll = false;
    };

    const handleGlobalTouchMove = (e) => {
      if (swipeStartX === 0 || isVerticalScroll) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(currentX - swipeStartX);
      const diffY = Math.abs(currentY - swipeStartY);
      
      // Check if this is a vertical scroll (should NOT trigger tab change)
      if (diffY > diffX && diffY > 20) {
        isVerticalScroll = true;
        swipeStartX = 0;
        swipeStartY = 0;
        return;
      }
      
      // Only consider it a swipe if horizontal movement is SIGNIFICANTLY dominant
      // Require horizontal movement to be at least 2x the vertical movement
      if (diffX > (diffY * 2) && diffX > 30) {
        isSwiping = true;
      }
    };

    const handleGlobalTouchEnd = (e) => {
      if (swipeStartX === 0 || !isSwiping || isVerticalScroll) {
        swipeStartX = 0;
        swipeStartY = 0;
        isSwiping = false;
        isVerticalScroll = false;
        return;
      }
      
      const swipeEndX = e.changedTouches[0].clientX;
      const swipeEndY = e.changedTouches[0].clientY;
      const distanceX = swipeStartX - swipeEndX;
      const distanceY = Math.abs(swipeStartY - swipeEndY);
      const minSwipeDistance = 100; // Increased from 80 to be even more deliberate
      
      // Final check: ensure horizontal swipe with minimal vertical movement
      if (Math.abs(distanceX) > minSwipeDistance && distanceY < 50) {
        const currentIndex = tabs.findIndex(tab => tab.id === activeFilter);
        const targetIndex = distanceX > 0 ? currentIndex + 1 : currentIndex - 1;
        
        // Allow swiping to trending, new, and custom tabs
        if (targetIndex >= 0 && targetIndex < tabs.length && 
            (tabs[targetIndex].id === 'trending' || tabs[targetIndex].id === 'new' || tabs[targetIndex].id === 'custom')) {
          onFilterChange({ type: tabs[targetIndex].id });
        }
      }
      
      swipeStartX = 0;
      swipeStartY = 0;
      isSwiping = false;
      isVerticalScroll = false;
    };

    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleGlobalTouchStart);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [activeFilter, onFilterChange]);

  return (
    <div className="top-tabs-container" ref={containerRef}>
      <div className="top-tabs-wrapper">
        {reorderedTabs.map((tab, index) => {
          const isActive = activeFilter === tab.id;
          const isCenter = tab.position === 'center';
          
          // Visual styling based on active state and position
          let opacity, zIndex, scale;
          
          if (isActive && isCenter) {
            opacity = 1;
            zIndex = 10;
            scale = 1.05;
          } else if (isCenter) {
            opacity = 1;
            zIndex = 10;
            scale = 1.05;
          } else {
            opacity = 0.6; // Dimmed side tabs
            zIndex = 5;
            scale = 0.9;
          }
          
          const canClick = tab.id === 'trending' || tab.id === 'new' || (tab.id === 'custom' && hasCustomFilters);
          const showClickHint = isActive && isCenter && canClick && onActiveTabClick;
          const isDisabled = tab.id === 'custom' && !hasCustomFilters;
          
          return (
            <button
              key={`${tab.id}-${tab.position}`}
              className={`top-tab ${isActive ? 'active' : ''} ${tab.position} ${showClickHint ? 'clickable-active' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation(); // Prevent event bubbling
                
                // Allow trending and new tabs always; custom only when filters are applied
                if (tab.id === 'trending' || tab.id === 'new' || (tab.id === 'custom' && hasCustomFilters)) {
                  // If clicking on the already active tab, show the coin list modal
                  if (isActive && onActiveTabClick) {
                    onActiveTabClick(tab.id);
                  } else {
                    onFilterChange({ type: tab.id });
                  }
                }
              }}
              onTouchEnd={(e) => {
                // Prevent touch event from triggering global swipe handler
                e.stopPropagation();
              }}
              style={{
                opacity: isDisabled ? 0.4 : opacity,
                zIndex,
                transform: `scale(${scale})`,
                cursor: (tab.id === 'trending' || tab.id === 'new' || (tab.id === 'custom' && hasCustomFilters)) ? 'pointer' : 'not-allowed',
                touchAction: 'none' // Prevent default touch behaviors
              }}
            >
              <span className="tab-label" style={{
                opacity: (tab.id === 'trending' || tab.id === 'new' || (tab.id === 'custom' && hasCustomFilters))
                  ? (isActive ? 1 : 0.8)
                  : 0.5,
                color: (tab.id === 'trending' || tab.id === 'new' || (tab.id === 'custom' && hasCustomFilters))
                  ? (isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.8)')
                  : 'rgba(255, 255, 255, 0.5)'
              }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Filter Button - positioned absolutely in top right */}
      {showFilterButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('🔥 Filter button clicked!', { onFilterClick, isFilterActive });
            if (onFilterClick) {
              onFilterClick();
            }
          }}
          className={`top-tab filter-tab ${isFilterActive ? 'active' : ''}`}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5H21V6H3V4.5ZM6 10.5H18V12H6V10.5ZM9 16.5H15V18H9V16.5Z" fill="currentColor"/>
          </svg>
          <span className="tab-label" style={{ fontSize: '9px', marginTop: '1px' }}>Filter</span>
        </button>
      )}
      
      {/* Progress indicator - removed since we have rotating design */}
    </div>
  );
};

export default TopTabs;
