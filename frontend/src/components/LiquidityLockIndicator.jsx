import React from 'react';
import './LiquidityLockIndicator.css';

const LiquidityLockIndicator = ({ 
  coin, 
  size = 'small', 
  showText = false,
  className = '' 
}) => {
  // Extract liquidity lock data from coin
  const isLocked = coin?.liquidityLocked || false;
  const lockPercentage = coin?.lockPercentage || 0;
  const burnPercentage = coin?.burnPercentage || 0;
  const rugcheckVerified = coin?.rugcheckVerified || false;
  const riskLevel = coin?.riskLevel;
  const isHoneypot = coin?.isHoneypot || false;

  // Determine the display status
  const getStatus = () => {
    // Priority 1: Show honeypot warning (critical)
    if (isHoneypot) {
      return {
        icon: 'warning',
        text: 'Honeypot',
        className: 'honeypot',
        color: '#ff4444',
        shouldShow: true
      };
    }
    
    // Priority 2: Show locked status (good news)
    if (isLocked) {
      if (lockPercentage >= 90 || burnPercentage >= 90) {
        return {
          icon: 'locked',
          text: `${Math.max(lockPercentage, burnPercentage)}% Locked`,
          className: 'locked-high',
          color: '#00ff88',
          shouldShow: true
        };
      } else if (lockPercentage >= 50 || burnPercentage >= 50) {
        return {
          icon: 'locked',
          text: `${Math.max(lockPercentage, burnPercentage)}% Locked`,
          className: 'locked-medium',
          color: '#ffaa00',
          shouldShow: true
        };
      } else if (lockPercentage > 0 || burnPercentage > 0) {
        return {
          icon: 'locked',
          text: `${Math.max(lockPercentage, burnPercentage)}% Locked`,
          className: 'locked-low',
          color: '#ff6600',
          shouldShow: true
        };
      }
    }
    
    // Priority 3: If rugcheck verified and liquidity is NOT locked, DON'T show icon
    // (This is the key change - we hide the unlocked icon)
    if (rugcheckVerified && !isLocked) {
      return {
        icon: 'unlocked',
        text: 'Unlocked',
        className: 'unlocked',
        color: '#ff4444',
        shouldShow: false // ⚠️ HIDE unlocked icon - only show locked ones
      };
    }
    
    // Priority 4: If not verified yet, don't show anything
    return {
      icon: 'question',
      text: 'Unknown',
      className: 'unknown',
      color: '#888888',
      shouldShow: false // ⚠️ HIDE unknown status
    };
  };

  const status = getStatus();
  
  // Don't render anything if we shouldn't show the indicator
  if (!status.shouldShow) {
    return null;
  }

  // Render the appropriate icon
  const renderIcon = () => {
    const iconSize = size === 'large' ? '18' : '14';
    
    switch (status.icon) {
      case 'locked':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'unlocked':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64537 18.3024 1.55294 18.6453 1.55199 18.9945C1.55103 19.3437 1.64157 19.6871 1.81445 19.9905C1.98733 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0127 20.2939 22.1856 19.9905C22.3584 19.6871 22.449 19.3437 22.448 18.9945C22.4471 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'question':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  // Create tooltip text
  const getTooltipText = () => {
    if (!rugcheckVerified) {
      return 'Liquidity lock status not verified';
    }
    
    let tooltip = `Liquidity: ${isLocked ? 'Locked' : 'Unlocked'}`;
    
    if (lockPercentage > 0) {
      tooltip += `\nLocked: ${lockPercentage}%`;
    }
    
    if (burnPercentage > 0) {
      tooltip += `\nBurned: ${burnPercentage}%`;
    }
    
    if (riskLevel) {
      tooltip += `\nRisk Level: ${riskLevel}`;
    }
    
    if (coin?.rugcheckScore) {
      tooltip += `\nRugcheck Score: ${coin.rugcheckScore}`;
    }
    
    return tooltip;
  };

  return (
    <div 
      className={`liquidity-lock-indicator ${status.className} ${size} ${className}`}
      title={getTooltipText()}
      style={{ '--indicator-color': status.color }}
    >
      <span 
        className="lock-icon" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#000000'
        }}
      >
        {renderIcon()}
      </span>
      {showText && (
        <span className="lock-text">
          {status.text}
        </span>
      )}
    </div>
  );
};

// 🔥 PERFORMANCE FIX: Memoize component to prevent unnecessary re-renders
export default React.memo(LiquidityLockIndicator, (prevProps, nextProps) => {
  // Only re-render if coin lock data changes
  return prevProps.coin?.liquidityLocked === nextProps.coin?.liquidityLocked &&
         prevProps.coin?.lockPercentage === nextProps.coin?.lockPercentage &&
         prevProps.coin?.burnPercentage === nextProps.coin?.burnPercentage &&
         prevProps.coin?.isHoneypot === nextProps.coin?.isHoneypot &&
         prevProps.size === nextProps.size &&
         prevProps.showText === nextProps.showText;
});

