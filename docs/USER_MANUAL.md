# User Manual — FindMe COD Settlement App

## For Delivery Agents

### What is FindMe?
FindMe is the app you use to record cash collected from customers and hand it over to your branch. It keeps a digital record of every rupee so nothing gets lost.

### How to Log In
1. Open the app on your phone
2. Enter your **Username** and **Password** (given to you by your manager)
3. Tap **Sign In**

> 💡 Tip: Tap **Add to Home Screen** in your browser to install the app so it opens faster.

---

### Step 1: Collect COD at the Doorstep

When you collect cash from a customer:

1. On your dashboard, tap the parcel you just delivered (e.g., **PRCL-001**)
2. Enter the **exact cash amount** you received from the customer
3. Optionally upload a photo of the receipt or cash
4. Tap **Submit Cash Collection**

The app will record the amount against your ID.

---

### Step 2: Hand Over Cash to the Branch

After your route is complete, go to the branch office:

1. Go to the **Handover** section
2. Select the parcel
3. Choose the branch staff member receiving the cash (from the dropdown)
4. Enter the **Transfer Amount**
5. Tap **Initiate Handover**

The branch staff will receive a notification to count and confirm.

> ⚠️ **Important:** Once you initiate a handover, DO NOT leave until the branch staff confirms it.

---

### Offline Mode

If you lose signal in the field:
- The app automatically saves your action
- A yellow "Syncing" badge appears at the top
- When signal returns, it automatically sends the data

You will see "You are offline. Action queued." — this is normal.

---

## For Branch Staff

### Confirming a Handover

When a Delivery Agent hands you cash:

1. Open the app and go to **Pending Confirmations**
2. Tap the parcel awaiting your confirmation
3. **Count the physical cash**
4. Enter the amount you counted in the **Confirm Amount** box
5. Tap **Submit Physical Handover Check**

**If the amounts match:** The handover is confirmed ✅  
**If the amounts don't match:** The system flags a **Discrepancy** ⚠️ and freezes the parcel until Finance resolves it.

---

### Initiating a Hub Handover

Once you've confirmed incoming cash from agents, you bundle it for the Hub:

1. Select the parcel
2. Choose **HANDOVER_TO_DEST_HUB** from the event type dropdown
3. Select the Hub Operator as the recipient
4. Enter the transfer amount
5. Tap **Initiate Handover**

---

## For Hub Operators

The flow is identical to Branch Staff — you confirm incoming handovers and initiate outbound ones.

At the **Destination Hub** → confirm from Branch Staff, then forward to **Origin Hub**.  
At the **Origin Hub** → confirm from Destination Hub, then forward to **Origin Branch**.

---

## For Finance Officers

### Viewing the Reconciliation Queue

1. Log in as Finance Officer
2. Your dashboard shows all **Discrepancy Flagged** parcels in red
3. Tap any parcel to see the full handover history — who transferred what, and what was counted

### Resolving a Discrepancy

1. Expand the flagged parcel
2. After investigation (call the agent, check CCTV etc.), select the **Target State** to resume the parcel at
3. Enter the **Resolved Amount** and a **Resolution Note** (e.g., "Agent recounted, ₹50 shortfall confirmed")
4. Tap **Submit Official Reconciliation Resolution**

The parcel is unfrozen and continues its journey.

---

### Approving Seller Payouts

When a parcel reaches **HANDOVER_TO_ORIGIN_BRANCH**:

1. Go to the **Payouts** tab
2. Find the parcel — it shows the seller name and COD amount
3. Arrange payment (bank transfer, UPI) outside the system
4. Enter the **Payment Reference ID** (UTR number / UPI transaction ID)
5. Tap **Mark as Settled to Seller**

The parcel state moves to **SETTLED_TO_SELLER** and a ledger event is created with the reference ID.

---

## For Sellers

Your dashboard shows all your parcels and their current settlement status:

| Status | What it means |
|---|---|
| **Created** | Parcel is dispatched, agent will collect COD soon |
| **COD Collected** | Agent has the cash, traveling to branch |
| **Dest Hub / Origin Hub** | Cash is traveling through the courier network |
| **Origin Branch** | Cash is at your local branch, payout pending |
| **Settled (Paid)** | Money has been transferred to you ✅ |
| **Discrepancy** | A mismatch was detected — Finance is investigating |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "CSRF token missing or invalid" | Log out and log back in to get a fresh token |
| "Too many requests" | Wait 15 minutes before trying to log in again |
| "Invalid credentials" | Check caps lock; contact your manager to reset password |
| App shows old data | Pull down to refresh, or tap the Sync button |
| Offline badge won't go away | Check your internet connection; the app will sync automatically |
