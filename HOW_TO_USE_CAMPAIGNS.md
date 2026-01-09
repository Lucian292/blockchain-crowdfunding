# How to Use Campaign Features - Complete Guide

## Overview

There are two ways to work with campaigns:
1. **Add Campaign** - Add an existing campaign to your list
2. **Create New Campaign via Factory** - Create a brand new campaign (you become the owner)

---

## 1. Add Campaign (Manual Addition)

### What it does:
- Adds an **existing** campaign to your personal list
- Does NOT create a new campaign
- Just saves the campaign address so you can interact with it

### When to use:
- Someone else created a campaign and gave you the address
- You want to add a campaign that was created earlier
- You have the campaign contract address

### How to use:

1. **Get the Campaign Address**
   - The address should be a valid CrowdFunding contract address
   - Format: `0x` followed by 40 hexadecimal characters
   - Example: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`

2. **Enter the Address**
   - In the "Add Campaign" section
   - Paste the campaign address in the input field
   - Click "Add Campaign"

3. **What happens:**
   - The app verifies the address is a valid CrowdFunding contract
   - Loads the campaign owner from the contract
   - Adds it to your list
   - You can now view and interact with it

### Example:
```
Campaign address: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
→ Click "Add Campaign"
→ Campaign appears in your list
```

---

## 2. Create New Campaign via Factory

### What it does:
- Creates a **brand new** CrowdFunding campaign
- You become the **owner** of the campaign
- Deploys a new contract on the blockchain
- Costs gas fees (ETH)

### When to use:
- You want to start a new fundraising campaign
- You want to be the owner of the campaign
- You have the Factory contract deployed

### Prerequisites:

1. **Factory Contract Must Be Deployed**
   - Run: `npx hardhat run scripts/deploy.ts --network localhost`
   - Copy the `CampaignFactory` address from the output
   - Example: `0x1234567890123456789012345678901234567890`

2. **Other Contracts Must Be Deployed**
   - Token contract
   - SponsorFunding contract
   - DistributeFunding contract
   - These addresses are already configured in the code

3. **You Must Be Connected to MetaMask**
   - Connect your wallet first
   - Make sure you're on the correct network (localhost, Sepolia, etc.)
   - Have some ETH for gas fees

### How to use:

#### Step 1: Get Factory Address

After deploying contracts, you'll see output like:
```
Deployer: 0x...
Token: 0x5FbDB2315678afecb367f032d93F642f64180aa3
SponsorFunding: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
DistributeFunding: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
CrowdFunding: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
CampaignFactory: 0x...  <-- COPY THIS ADDRESS
```

#### Step 2: Enter Factory Address

- In the "Or Create New Campaign via Factory" section
- Paste the Factory address in "Factory contract address" field
- Example: `0x1234567890123456789012345678901234567890`

#### Step 3: Enter Funding Goal

- In the "Funding goal" field
- Enter the amount in tokens (not ETH, not wei)
- Example: `1000` means 1000 tokens
- Example: `5000` means 5000 tokens

#### Step 4: Create Campaign

- Click "Create Campaign"
- Confirm the transaction in MetaMask
- Wait for confirmation
- The new campaign will be added to your list automatically
- **You will be the owner!**

### Example:
```
Factory address: 0x1234567890123456789012345678901234567890
Funding goal: 2000
→ Click "Create Campaign"
→ Confirm in MetaMask
→ New campaign created!
→ You are now the owner
```

---

## Troubleshooting

### Problem: "I created a campaign but I'm not the owner"

**Possible causes:**

1. **Factory contract not updated**
   - The Factory contract must be recompiled and redeployed with the latest changes
   - Old factory contracts don't pass the owner parameter
   - **Solution:** Redeploy the factory contract

2. **Wrong network**
   - You're connected to a different network than where contracts are deployed
   - **Solution:** Check MetaMask network matches your deployment network

3. **Owner not loaded yet**
   - The app might still be loading owner information
   - **Solution:** Wait a moment and refresh, or click "View Campaign" to load owner

### Problem: "I can't remove my campaign"

**Possible causes:**

1. **Owner not verified**
   - The app hasn't loaded the owner yet
   - **Solution:** Click "View Campaign" first, which loads the owner

2. **You're not actually the owner**
   - If you used an old factory contract, the factory might be the owner
   - **Solution:** Check the campaign owner in the contract directly

3. **Network mismatch**
   - Your account address doesn't match the owner on the current network
   - **Solution:** Make sure you're on the correct network

### Problem: "Invalid factory address" or "missing revert data"

**Possible causes:**

1. **Factory not deployed**
   - The factory contract hasn't been deployed yet
   - **Solution:** Deploy contracts first: `npx hardhat run scripts/deploy.ts --network localhost`

2. **Wrong network**
   - Factory is deployed on a different network
   - **Solution:** Switch MetaMask to the correct network

3. **Wrong address**
   - The factory address is incorrect
   - **Solution:** Copy the exact address from deploy output

---

## Step-by-Step: Creating Your First Campaign

### Complete Workflow:

1. **Start Hardhat Node**
   ```bash
   npx hardhat node
   ```

2. **Deploy Contracts** (in another terminal)
   ```bash
   npx hardhat run scripts/deploy.ts --network localhost
   ```

3. **Copy Factory Address**
   - From the deploy output, copy the `CampaignFactory` address
   - Example: `0x1234567890123456789012345678901234567890`

4. **Start the DApp**
   ```bash
   cd dapp
   npm run dev
   ```

5. **Connect MetaMask**
   - Click "Connect Wallet"
   - Make sure you're on `localhost:8545` network
   - Import one of the Hardhat accounts if needed

6. **Create Campaign**
   - Paste Factory address in "Factory contract address"
   - Enter funding goal (e.g., `1000`)
   - Click "Create Campaign"
   - Confirm in MetaMask

7. **Verify Ownership**
   - Click "View Campaign" on your new campaign
   - Check "You are owner: ✅ YES"
   - Try the "Remove" button - it should be enabled

---

## Important Notes

### About Ownership:

- **When you CREATE a campaign via Factory:** You become the owner ✅
- **When you ADD an existing campaign:** You are NOT the owner (unless you were already) ❌
- **Owner is set at contract creation time** - it cannot be changed later

### About Addresses:

- **Campaign Address:** The address of a specific CrowdFunding contract
- **Factory Address:** The address of the CampaignFactory contract (used to create new campaigns)
- These are different addresses!

### About Networks:

- Make sure all contracts are on the same network
- Make sure MetaMask is on the same network
- Localhost network = `http://127.0.0.1:8545`

---

## Quick Reference

| Action | What You Need | What Happens |
|--------|--------------|--------------|
| **Add Campaign** | Campaign address (0x...) | Adds existing campaign to list |
| **Create Campaign** | Factory address + Funding goal | Creates new campaign, you become owner |

---

## Still Having Issues?

1. **Check console for errors** (F12 in browser)
2. **Verify contracts are deployed** on the current network
3. **Check MetaMask network** matches deployment network
4. **Try refreshing the page** after connecting wallet
5. **Make sure Factory contract is the latest version** (with owner parameter support)
