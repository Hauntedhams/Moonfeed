# Jupiter Trigger API Integration 🎯

Complete implementation of Jupiter's Trigger API for limit orders and stop orders in the Moonfeed meme coin discovery app.

## Overview

The Jupiter Trigger API integration allows users to:
- **Create limit orders** - Buy/sell at specific target prices
- **Create stop orders** - Execute trades when price drops to stop level
- **View active orders** - Track all pending limit/stop orders
- **Cancel orders** - Remove orders before execution
- **View order history** - See past executed/cancelled orders

## Architecture

### Backend

#### Services
- **`services/jupiterTriggerService.js`** - Core service for Jupiter Trigger API
  - `createOrder()` - Generate unsigned order transaction
  - `executeOrder()` - Execute signed transaction
  - `cancelOrder()` - Cancel single order
  - `cancelOrders()` - Cancel multiple orders
  - `getTriggerOrders()` - Fetch user's orders
  - Helper functions for price calculations

#### Routes
- **`routes/trigger.js`** - RESTful API endpoints
  - `POST /api/trigger/create-order` - Create new order
  - `POST /api/trigger/execute` - Execute signed transaction
  - `POST /api/trigger/cancel-order` - Cancel order
  - `POST /api/trigger/cancel-orders` - Bulk cancel
  - `GET /api/trigger/orders` - Get user orders
  - `POST /api/trigger/calculate-price` - Helper for price calculations

### Frontend

#### Components

**`TriggerOrderModal.jsx`** - Main limit order creation interface
- Order type selection (Limit vs Stop)
- Buy/Sell toggle
- Amount input
- Trigger price input (by price or percentage)
- Quick percentage buttons (-50%, -25%, -10%, +10%, +25%, +50%, +100%)
- Expiry selection (1h, 24h, 7d, 30d)
- Order summary preview

**`ActiveOrdersModal.jsx`** - View and manage orders
- Active/History tabs
- Order list with details
- Cancel functionality
- Real-time status updates

**`JupiterTradeModal.jsx`** - Enhanced with tabs
- Tab 1: ⚡ Instant Swap (existing Jupiter widget)
- Tab 2: 🎯 Limit Order (new trigger functionality)

## API Endpoints

### Create Order
```javascript
POST /api/trigger/create-order
Body: {
  maker: "wallet_address",
  inputMint: "token_mint_address",
  outputMint: "token_mint_address",
  makingAmount: "1000000000", // in smallest unit
  takingAmount: "5000000000",
  expiredAt: 1729123456789, // Unix timestamp (optional)
  orderType: "limit" // or "stop"
}

Response: {
  success: true,
  transaction: "base64_encoded_unsigned_tx",
  orderParams: {...}
}
```

### Execute Order
```javascript
POST /api/trigger/execute
Body: {
  signedTransaction: "base64_encoded_signed_tx"
}

Response: {
  success: true,
  orderId: "order_id",
  signature: "transaction_signature"
}
```

### Get Orders
```javascript
GET /api/trigger/orders?wallet=WALLET&status=active&page=1&limit=20

Response: {
  success: true,
  orders: [...],
  total: 10,
  hasMore: false
}
```

### Cancel Order
```javascript
POST /api/trigger/cancel-order
Body: {
  maker: "wallet_address",
  orderId: "order_id_to_cancel"
}

Response: {
  success: true,
  transaction: "base64_encoded_unsigned_cancellation_tx"
}
```

## User Flow

### Creating a Limit Order

1. **User clicks Trade button** on any coin
2. **JupiterTradeModal opens** with two tabs
3. **User selects "Limit Order" tab**
4. **TriggerOrderModal appears** with:
   - Current coin price displayed
   - Order type selection (Limit/Stop)
   - Buy/Sell toggle
   - Amount input (in SOL or token)
   - Trigger price input:
     - By exact price: $0.00001234
     - By percentage: +50% (from current price)
   - Quick percentage buttons for fast selection
   - Expiry duration selection
   - Order summary preview
5. **User clicks "Create Limit Order"**
6. **Backend generates unsigned transaction**
7. **TODO**: Wallet signs transaction (requires Phantom/Solflare integration)
8. **Order is submitted to Jupiter**
9. **Success message shown**

### Viewing Active Orders

1. **User opens Active Orders modal** (needs UI button)
2. **Modal fetches orders** from backend
3. **Orders displayed** with:
   - Order type badge (Limit/Stop)
   - Status badge (Active/Executed/Cancelled)
   - Pair information
   - Amount and trigger price
   - Expiry date
   - Created date
4. **User can cancel** active orders
5. **Switch to History tab** to view past orders

## Features

### Order Types
- **Limit Order** 🎯 - Execute when price reaches target level
- **Stop Order** 🛑 - Execute when price drops to stop level

### Price Input Methods
- **Exact Price** - Enter specific price: $0.00001234
- **Percentage** - Enter % change: +50% automatically calculates price
- **Quick Buttons** - One-click common percentages

### Expiry Options
- 1 hour
- 24 hours
- 7 days
- 30 days

### Order Management
- View active orders
- View order history
- Cancel pending orders
- Real-time status updates

## Integration Status

### ✅ Complete
- Backend service layer
- RESTful API endpoints
- Frontend UI components
- Order creation interface
- Order viewing interface
- Price calculation helpers
- Tab navigation in trade modal

### 🚧 TODO
1. **Wallet Integration**
   - Connect Phantom/Solflare wallet
   - Sign transactions
   - Execute orders on-chain
   
2. **UI Enhancements**
   - Add "View Orders" button to app header/menu
   - Add notification badges for active orders
   - Add toast notifications for order events
   
3. **Order Monitoring**
   - WebSocket for real-time order status updates
   - Push notifications when orders execute
   - Price alerts when approaching trigger price

4. **Advanced Features**
   - Market price tracking
   - Order book visualization
   - Multiple order creation (OCO - One Cancels Other)
   - Trailing stop orders

## Usage Example

```javascript
// In your component
import TriggerOrderModal from './components/TriggerOrderModal';

function MyComponent() {
  const [showTrigger, setShowTrigger] = useState(false);
  const walletAddress = "Your_Wallet_Address";
  
  const coin = {
    symbol: "PEPE",
    name: "Pepe",
    mintAddress: "mint_address",
    priceUsd: 0.00001234,
    image: "image_url"
  };

  return (
    <>
      <button onClick={() => setShowTrigger(true)}>
        Create Limit Order
      </button>
      
      <TriggerOrderModal
        isOpen={showTrigger}
        onClose={() => setShowTrigger(false)}
        coin={coin}
        walletAddress={walletAddress}
        onOrderCreated={(result) => {
          console.log('Order created:', result);
        }}
      />
    </>
  );
}
```

## Technical Notes

### Amount Conversion
- All amounts are stored in smallest unit (lamports for SOL)
- 1 SOL = 1,000,000,000 lamports
- Use `toSmallestUnit()` and `fromSmallestUnit()` helpers

### Price Calculation
```javascript
// Calculate trigger price from percentage
const triggerPrice = currentPrice * (1 + percentage / 100);

// Example: Current price $0.001, +50%
// Trigger price = 0.001 * (1 + 50/100) = $0.0015
```

### Order Execution
Orders execute automatically when:
- **Limit Order**: Market price reaches or exceeds trigger price
- **Stop Order**: Market price drops to or below trigger price

### Security
- All transactions require wallet signature
- Orders are non-custodial (user maintains control)
- Funds locked in escrow until execution or cancellation

## Testing

### Backend Testing
```bash
# Test order creation
curl -X POST http://localhost:3001/api/trigger/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "maker": "wallet_address",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "token_mint",
    "makingAmount": "1000000000",
    "takingAmount": "5000000000",
    "orderType": "limit"
  }'

# Test get orders
curl http://localhost:3001/api/trigger/orders?wallet=WALLET_ADDRESS&status=active
```

### Frontend Testing
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Click trade button on any coin
4. Click "Limit Order" tab
5. Fill in order details
6. Click "Create Limit Order"

## Dependencies

### Backend
- `express` - Web server
- `node-fetch` - HTTP client for Jupiter API

### Frontend
- `react` - UI framework
- Existing Jupiter Terminal integration

## Resources

- [Jupiter Trigger API Docs](https://station.jup.ag/docs/apis/trigger-api)
- [Jupiter Terminal Docs](https://station.jup.ag/docs/apis/terminal)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)

## Support

For issues or questions:
1. Check Jupiter documentation
2. Review backend logs
3. Check browser console for frontend errors
4. Verify wallet connection status

---

**Status**: Backend and frontend UI complete. Wallet signature integration pending.
