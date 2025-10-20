# 🧪 EXPIRED ORDER HANDLING - TESTING CHECKLIST

## 🎯 TESTING OBJECTIVE
Verify that expired limit orders are properly detected, displayed, and can be cancelled to retrieve funds.

---

## ✅ PRE-TESTING SETUP

### Requirements
- [ ] Frontend running (`npm run dev` in `/frontend`)
- [ ] Backend running (`npm run dev` in `/backend`)
- [ ] Wallet connected (Phantom/Solflare/etc)
- [ ] At least 0.1 SOL in wallet (for testing orders)
- [ ] Jupiter Trigger API accessible

### Test Order Creation
**Option 1**: Create a test order with 1-minute expiration
**Option 2**: Use existing expired order from user report

---

## 🔬 TEST CASES

### TEST 1: Active Tab - Expired Order Filtering
**Objective**: Expired orders should NOT appear in Active tab

#### Steps:
1. Navigate to Profile → Limit Orders
2. Select "Active" tab
3. Check for orders

#### Expected Results:
- [ ] ✅ No expired orders visible
- [ ] ✅ Only orders with future expiration shown
- [ ] ✅ Empty state if no active orders
- [ ] ✅ Console log shows: `[Profile] Found X expired order(s)`

#### Test Data:
```
Order ID: __________________
Expiration: [Past Date]
Expected: NOT in Active tab
Actual: ___________________
```

---

### TEST 2: History Tab - Expired Order Display
**Objective**: Expired orders should appear in History with warnings

#### Steps:
1. Navigate to Profile → Limit Orders
2. Select "History" tab
3. Look for expired order

#### Expected Results:
- [ ] ✅ Order visible in History tab
- [ ] ✅ Red warning banner at top: "ORDER EXPIRED - FUNDS LOCKED"
- [ ] ✅ Warning text: "Your funds are currently held in Jupiter's escrow"
- [ ] ✅ Instruction: "You must cancel this order to retrieve your funds!"
- [ ] ✅ Expiry field shows: "⚠️ EXPIRED" in red

#### Visual Checklist:
- [ ] Banner has red gradient background
- [ ] Banner has ⚠️ warning icon
- [ ] Text is white on red background
- [ ] Banner positioned at top of order card

---

### TEST 3: Expiry Time Display
**Objective**: Correct time calculation and warning colors

#### Steps:
1. Check multiple orders with different expiry times
2. Verify time calculations

#### Expected Results:

| Time Remaining | Display          | Color  | Weight |
|---------------|------------------|--------|--------|
| 2h 30m        | "2h 30m"        | Normal | Normal |
| 45m           | "45m"           | Red    | Bold   |
| Expired       | "⚠️ EXPIRED"    | Red    | Bold   |
| No expiry     | "No expiry"     | Normal | Normal |

#### Test Data:
```
Order 1: Expires in _____ → Shows: _____ → Color: _____
Order 2: Expires in _____ → Shows: _____ → Color: _____
Order 3: Expired _____ ago → Shows: _____ → Color: _____
```

---

### TEST 4: Cancel Button - Normal Order
**Objective**: Normal orders have standard cancel button

#### Steps:
1. Find an active order (not expired)
2. Check cancel button appearance

#### Expected Results:
- [ ] ✅ Button text: "🗑️ Cancel Order"
- [ ] ✅ Normal styling (not red)
- [ ] ✅ No pulsing animation
- [ ] ✅ Standard size

---

### TEST 5: Cancel Button - Expired Order
**Objective**: Expired orders have urgent cancel button

#### Steps:
1. Find an expired order in History tab
2. Check cancel button appearance

#### Expected Results:
- [ ] ✅ Button text: "⚡ CANCEL & RETRIEVE FUNDS"
- [ ] ✅ Red gradient background
- [ ] ✅ **PULSING ANIMATION** visible
- [ ] ✅ Larger size (14px padding, 16px font)
- [ ] ✅ Bold text (font-weight: 700)
- [ ] ✅ Shadow effect visible
- [ ] ✅ Instruction below: "Click to return your funds from escrow"

#### Animation Check:
```
Watch button for 5 seconds:
Time 0s: Button at normal size    → [ ]
Time 1s: Button slightly larger   → [ ]
Time 2s: Button back to normal    → [ ]
Loop continues?                   → [ ]
```

---

### TEST 6: Order Cancellation - Expired Order
**Objective**: Can successfully cancel expired order and retrieve funds

#### ⚠️ CRITICAL TEST - Real funds involved!

#### Pre-Test Check:
- [ ] Record wallet balance before: _______ SOL
- [ ] Record order escrow amount: _______ SOL
- [ ] Have Solscan ready to verify transaction

#### Steps:
1. Click "⚡ CANCEL & RETRIEVE FUNDS" on expired order
2. Wait for wallet popup
3. Approve transaction in wallet
4. Wait for confirmation

#### Expected Results:
- [ ] ✅ Button shows "⏳ Cancelling..." during process
- [ ] ✅ Wallet prompts for transaction approval
- [ ] ✅ Transaction succeeds (no errors)
- [ ] ✅ Success message: "Order cancelled successfully!"
- [ ] ✅ Transaction signature shown
- [ ] ✅ "Click OK to view on Solscan" prompt
- [ ] ✅ Order removed from History tab OR status changes to "cancelled"
- [ ] ✅ Funds returned to wallet (check balance)

#### Post-Test Verification:
```
Wallet balance after: _______ SOL
Expected increase: _______ SOL (minus gas)
Actual increase: _______ SOL
Transaction signature: _______________________
Solscan link: https://solscan.io/tx/_______
```

#### On Solscan, verify:
- [ ] Transaction type: "Cancel Limit Order"
- [ ] Status: Success
- [ ] SOL returned to wallet
- [ ] Jupiter program involved

---

### TEST 7: Console Logging
**Objective**: Proper logging for debugging

#### Steps:
1. Open browser DevTools → Console
2. Navigate to Profile → Limit Orders
3. Switch between Active/History tabs

#### Expected Console Logs:
```
When expired orders found:
[Profile] Found X expired order(s) in active orders: [...]

Check console for:
- [ ] Warning message when expired orders detected
- [ ] Order IDs logged
- [ ] Expiration timestamps logged
- [ ] No errors during filtering
```

---

### TEST 8: Edge Cases

#### 8.1: Order with No Expiration
**Steps**: View order created without expiration date

**Expected**:
- [ ] Shows "No expiry" in normal color
- [ ] No warning styling
- [ ] Normal cancel button

#### 8.2: Order with Invalid Expiration
**Steps**: Corrupt expiration data (if possible)

**Expected**:
- [ ] Graceful fallback (treats as no expiry)
- [ ] No errors/crashes
- [ ] Console error logged

#### 8.3: Multiple Expired Orders
**Steps**: Create/view multiple expired orders

**Expected**:
- [ ] All filtered from Active tab
- [ ] All shown in History tab
- [ ] Each has red warning banner
- [ ] Each has pulsing button
- [ ] Console logs count: "Found X expired orders"

#### 8.4: Order Expiring During Session
**Steps**: Create order with 2-minute expiration, wait

**Expected**:
- [ ] Shows in Active with countdown
- [ ] Countdown turns red at < 1hr (or immediate if < 1min)
- [ ] After expiration, refresh moves to History
- [ ] Warning banner appears after refresh

---

### TEST 9: Mobile Responsiveness

#### Device Tests:
- [ ] iPhone SE (375px width)
- [ ] iPhone 12 Pro (390px width)
- [ ] iPad (768px width)

#### Expected on Mobile:
- [ ] Warning banner readable (text not cut off)
- [ ] Cancel button full width
- [ ] Animation smooth (no lag)
- [ ] Touch targets large enough (44px minimum)
- [ ] No horizontal scroll

---

### TEST 10: Performance

#### Steps:
1. Load Profile with 10+ orders
2. Include 3-5 expired orders
3. Monitor performance

#### Expected:
- [ ] ✅ Page loads in < 2 seconds
- [ ] ✅ No lag when filtering orders
- [ ] ✅ Animation smooth (60fps)
- [ ] ✅ No excessive re-renders
- [ ] ✅ Memory usage stable

#### Performance Metrics:
```
Orders loaded: _____
Expired orders: _____
Time to filter: _____ ms
Render time: _____ ms
Animation FPS: _____
```

---

### TEST 11: User Flow - Complete Journey

#### Scenario: User reports "my $10 order still shows as active"

**Steps**:
1. User opens app
2. Navigates to Profile
3. Clicks "Limit Orders"
4. Checks Active tab
5. Sees no order (or other active orders only)
6. Switches to History tab
7. Sees expired order with red warning
8. Reads warning message
9. Clicks "CANCEL & RETRIEVE FUNDS"
10. Approves in wallet
11. Sees success message
12. Checks wallet balance
13. Confirms funds returned

**Expected User Reactions**:
- [ ] ✅ "Oh, my order expired - that's why it's not active"
- [ ] ✅ "I can see my funds are in escrow"
- [ ] ✅ "I know exactly what to do - cancel the order"
- [ ] ✅ "The button is clear and easy to find"
- [ ] ✅ "My funds are back - everything works!"

**Time to Resolution**: _____ seconds  
**User Confidence**: High / Medium / Low  
**Needed Support**: Yes / No

---

## 🐛 BUG REPORTING

If any test fails, document:

```
Test Case: #____
Expected: ___________________
Actual: _____________________
Error Message: ______________
Console Logs: _______________
Screenshots: ________________
Browser: ____________________
Wallet: _____________________
Reproduction Steps:
1. _________________________
2. _________________________
3. _________________________
```

---

## ✅ SIGN-OFF CHECKLIST

Before marking as complete:

### Functionality
- [ ] All expired orders filtered from Active tab
- [ ] All expired orders visible in History tab
- [ ] Warning banner displays correctly
- [ ] Cancel button styled correctly
- [ ] Animation works smoothly
- [ ] Cancellation retrieves funds

### UX
- [ ] UI is clear and understandable
- [ ] User knows funds are safe
- [ ] User knows how to retrieve funds
- [ ] No confusion about order state
- [ ] Professional appearance

### Technical
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Mobile responsive
- [ ] Edge cases handled
- [ ] Logging works

### Documentation
- [ ] Implementation guide created
- [ ] Visual guide created
- [ ] User instructions clear
- [ ] Code commented

---

## 📊 TEST RESULTS SUMMARY

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Active filtering | ⬜ | |
| 2. History display | ⬜ | |
| 3. Expiry time | ⬜ | |
| 4. Normal cancel | ⬜ | |
| 5. Expired cancel | ⬜ | |
| 6. Cancellation | ⬜ | |
| 7. Console logs | ⬜ | |
| 8. Edge cases | ⬜ | |
| 9. Mobile | ⬜ | |
| 10. Performance | ⬜ | |
| 11. User flow | ⬜ | |

**Overall Status**: ⬜ Pass / ⬜ Fail / ⬜ Partial

---

## 🚀 DEPLOYMENT READINESS

- [ ] All tests passed
- [ ] User tested and approved
- [ ] Performance verified
- [ ] Documentation complete
- [ ] Team reviewed

**Ready for Production**: ⬜ Yes / ⬜ No / ⬜ With caveats

**Tested By**: _______________  
**Date**: _______________  
**Approved By**: _______________

---

## 📝 NOTES

_Use this space for additional observations, issues, or recommendations:_

```
[Your notes here]
```

---

**Next Steps After Testing**:
1. ✅ Fix any bugs found
2. ✅ Re-test failed cases
3. ✅ Get user confirmation
4. ✅ Deploy to production
5. ✅ Monitor metrics
6. ✅ Gather user feedback
