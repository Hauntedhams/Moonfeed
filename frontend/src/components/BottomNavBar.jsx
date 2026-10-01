import React, { useState } from 'react';
import './BottomNavBar.css';

function BottomNavBar({ activeTab, setActiveTab, onSearchClick, onOrdersClick, tradesBadgeCount, onXTrackerClick, xNewsUnread }) {
  const tradesBadge = tradesBadgeCount ?? 0;

  return (
    <nav className="bottom-nav">
      <button className={`nav-btn${activeTab === 'home' ? ' active' : ''}`} onClick={() => setActiveTab('home')}>
        <span className="nav-icon">
          {/* Home icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.5L10 4L17 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 17V10.5H15V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <span className="nav-label">Home</span>
      </button>
      {/* Trades button - Holdings, limit orders and history */}
      <button 
        className={`nav-btn${activeTab === 'orders' ? ' active' : ''}`} 
        onClick={onOrdersClick || (() => setActiveTab('profile'))}
        title="View your holdings, orders and trade history"
      >
        <span className="nav-icon">
          {/* Orders/List icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12h6m-6 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {tradesBadge > 0 && (
            <span className="nav-badge">{tradesBadge > 99 ? '99+' : tradesBadge}</span>
          )}
        </span>
        <span className="nav-label">Trades</span>
      </button>
      <button className={`nav-btn nav-btn-trade${activeTab === 'trade' ? ' active' : ''}`} onClick={() => setActiveTab('trade')}>
        <span className="nav-icon">
          {/* Trade/Swap icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10H16M16 10L12 6M16 10L12 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <span className="nav-label">Trade</span>
      </button>
      <button className={`nav-btn${activeTab === 'x-tracker' ? ' active' : ''}`} onClick={onXTrackerClick} title="Open X Tracker">
        <span className="nav-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          {xNewsUnread > 0 && <span className="nav-badge" aria-label="New X news">{xNewsUnread > 9 ? '9+' : xNewsUnread}</span>}
        </span>
        <span className="nav-label">X Tracker</span>
      </button>
      <button className={`nav-btn${activeTab === 'profile' ? ' active' : ''}`} onClick={() => setActiveTab('profile')}>
        <span className="nav-icon">
          {/* User/Profile icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17C3 14.2386 6.13401 12 10 12C13.866 12 17 14.2386 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </span>
        <span className="nav-label">Profile</span>
      </button>
    </nav>
  );
}

export default BottomNavBar;
