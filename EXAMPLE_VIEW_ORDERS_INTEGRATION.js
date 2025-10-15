/**
 * Example: How to Add "View Orders" Button to Your App
 * 
 * This shows how to integrate the ActiveOrdersModal into your app's UI
 */

import React, { useState } from 'react';
import ActiveOrdersModal from './components/ActiveOrdersModal';

// ====================================
// OPTION 1: Add to App Header/Navigation
// ====================================

function AppHeader({ walletAddress }) {
  const [showOrders, setShowOrders] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="logo">Moonfeed</div>
        
        <nav className="header-nav">
          {/* Your existing nav items */}
          
          {/* NEW: Add Orders Button */}
          {walletAddress && (
            <button 
              className="nav-btn orders-btn"
              onClick={() => setShowOrders(true)}
            >
              📋 My Orders
            </button>
          )}
        </nav>
      </header>

      {/* Orders Modal */}
      <ActiveOrdersModal
        isOpen={showOrders}
        onClose={() => setShowOrders(false)}
        walletAddress={walletAddress}
      />
    </>
  );
}

// ====================================
// OPTION 2: Add as Floating Action Button
// ====================================

function FloatingOrdersButton({ walletAddress }) {
  const [showOrders, setShowOrders] = useState(false);
  const [activeOrderCount, setActiveOrderCount] = useState(0);

  // Optional: Fetch active order count
  useEffect(() => {
    if (walletAddress) {
      fetchOrderCount();
    }
  }, [walletAddress]);

  const fetchOrderCount = async () => {
    const response = await fetch(
      `${API_URL}/api/trigger/orders?wallet=${walletAddress}&status=active`
    );
    const data = await response.json();
    setActiveOrderCount(data.orders?.length || 0);
  };

  if (!walletAddress) return null;

  return (
    <>
      <button 
        className="floating-orders-btn"
        onClick={() => setShowOrders(true)}
      >
        📋
        {activeOrderCount > 0 && (
          <span className="order-badge">{activeOrderCount}</span>
        )}
      </button>

      <ActiveOrdersModal
        isOpen={showOrders}
        onClose={() => setShowOrders(false)}
        walletAddress={walletAddress}
      />

      <style jsx>{`
        .floating-orders-btn {
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4FC3F7, #677EEA);
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(79, 195, 247, 0.4);
          transition: all 0.3s;
          z-index: 1000;
        }

        .floating-orders-btn:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(79, 195, 247, 0.6);
        }

        .order-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #EF5350;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}

// ====================================
// OPTION 3: Add to Bottom Navigation
// ====================================

function BottomNav({ walletAddress }) {
  const [showOrders, setShowOrders] = useState(false);

  return (
    <>
      <nav className="bottom-nav">
        <button className="nav-item">
          🏠 Home
        </button>
        <button className="nav-item">
          ⭐ Favorites
        </button>
        <button 
          className="nav-item"
          onClick={() => setShowOrders(true)}
        >
          📋 Orders
        </button>
        <button className="nav-item">
          👤 Profile
        </button>
      </nav>

      <ActiveOrdersModal
        isOpen={showOrders}
        onClose={() => setShowOrders(false)}
        walletAddress={walletAddress}
      />
    </>
  );
}

// ====================================
// OPTION 4: Add to Trade Modal Footer
// ====================================

// In JupiterTradeModal.jsx, update the footer:

function JupiterTradeModal({ coin, walletAddress, isOpen, onClose }) {
  const [showOrders, setShowOrders] = useState(false);

  return (
    <div className="jupiter-modal">
      {/* Existing modal content */}
      
      {/* Updated Footer */}
      <div className="jupiter-modal-footer">
        <p className="powered-by">Powered by Jupiter</p>
        
        {/* NEW: View Orders Link */}
        <button 
          className="view-orders-link"
          onClick={() => setShowOrders(true)}
        >
          📋 View My Orders
        </button>
      </div>

      {/* Orders Modal */}
      <ActiveOrdersModal
        isOpen={showOrders}
        onClose={() => setShowOrders(false)}
        walletAddress={walletAddress}
      />
    </div>
  );
}

// ====================================
// OPTION 5: Add to Coin Detail Page
// ====================================

function CoinDetailPage({ coin, walletAddress }) {
  const [showOrders, setShowOrders] = useState(false);

  return (
    <div className="coin-detail">
      {/* Existing coin details */}
      
      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn-primary">
          ⚡ Trade Now
        </button>
        <button 
          className="btn-secondary"
          onClick={() => setShowOrders(true)}
        >
          📋 My Orders for {coin.symbol}
        </button>
      </div>

      {/* Orders Modal - filtered for this coin */}
      <ActiveOrdersModal
        isOpen={showOrders}
        onClose={() => setShowOrders(false)}
        walletAddress={walletAddress}
        // Could add filter for specific coin
      />
    </div>
  );
}

// ====================================
// FULL EXAMPLE: Complete App Integration
// ====================================

import React, { useState, useEffect } from 'react';
import JupiterTradeModal from './components/JupiterTradeModal';
import ActiveOrdersModal from './components/ActiveOrdersModal';
import TriggerOrderModal from './components/TriggerOrderModal';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [coinToTrade, setCoinToTrade] = useState(null);

  // Connect wallet
  const connectWallet = async () => {
    if (window.solana) {
      const response = await window.solana.connect();
      setWalletAddress(response.publicKey.toString());
    }
  };

  // Handle trade button click
  const handleTradeClick = (coin) => {
    setCoinToTrade(coin);
    setTradeModalOpen(true);
  };

  return (
    <div className="app">
      {/* Header with wallet and orders */}
      <header className="app-header">
        <div className="logo">Moonfeed 🚀</div>
        
        <div className="header-actions">
          {walletAddress ? (
            <>
              <button 
                className="orders-btn"
                onClick={() => setOrdersModalOpen(true)}
              >
                📋 My Orders
              </button>
              <div className="wallet-display">
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </div>
            </>
          ) : (
            <button onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Your existing app content */}
      <main>
        {/* Coin list, feed, etc. */}
      </main>

      {/* Trade Modal with tabs */}
      <JupiterTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        coin={coinToTrade}
        walletAddress={walletAddress}
        onSwapSuccess={(result) => {
          console.log('Swap success:', result);
        }}
        onSwapError={(error) => {
          console.error('Swap error:', error);
        }}
      />

      {/* Orders Modal */}
      <ActiveOrdersModal
        isOpen={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
        walletAddress={walletAddress}
      />

      {/* Optional: Floating Orders Button */}
      {walletAddress && (
        <button 
          className="floating-orders-btn"
          onClick={() => setOrdersModalOpen(true)}
        >
          📋
        </button>
      )}
    </div>
  );
}

export default App;

// ====================================
// STYLING EXAMPLE
// ====================================

const styles = `
  .orders-btn {
    padding: 10px 20px;
    background: linear-gradient(135deg, #4FC3F7, #677EEA);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .orders-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 195, 247, 0.4);
  }

  .floating-orders-btn {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4FC3F7, #677EEA);
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(79, 195, 247, 0.4);
    z-index: 1000;
  }

  .view-orders-link {
    margin-top: 8px;
    padding: 8px 16px;
    background: rgba(79, 195, 247, 0.1);
    border: 1px solid rgba(79, 195, 247, 0.3);
    border-radius: 8px;
    color: #4FC3F7;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-orders-link:hover {
    background: rgba(79, 195, 247, 0.2);
    border-color: #4FC3F7;
  }
`;

// ====================================
// TIPS
// ====================================

/*
1. Always check if walletAddress exists before showing orders
2. Consider showing order count badge for better UX
3. You can filter orders by specific coin if needed
4. Add loading state while fetching orders
5. Handle errors gracefully with toast notifications
6. Consider adding refresh button in orders modal
7. Mobile: Use bottom sheet instead of modal
8. Add keyboard shortcuts (e.g., Ctrl+O for orders)
*/
