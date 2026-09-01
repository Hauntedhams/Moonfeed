import React, { useState } from 'react';
import './BottomNavBar.css';
import { useAlerts } from '../contexts/AlertsContext';

function BottomNavBar({ activeTab, setActiveTab, onSearchClick, onOrdersClick, notificationCount }) {
  const { unreadCount, markAllRead } = useAlerts();
  const badgeCount = notificationCount ?? unreadCount ?? 0;

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
      <button className={`nav-btn${activeTab === 'tracked' ? ' active' : ''}`} onClick={() => { setActiveTab('tracked'); markAllRead(); }}>
        <span className="nav-icon">
          {/* Radar/Track icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M10 1.5V4M10 16V18.5M1.5 10H4M16 10H18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          {badgeCount > 0 && (
            <span className="nav-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
          )}
        </span>
        <span className="nav-label">Tracked</span>
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
