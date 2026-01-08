# Multiple Campaign System Documentation

## Overview

The blockchain crowdfunding application has been refactored to support **multiple crowdfunding campaigns** instead of a single campaign. This allows users to create, manage, and interact with multiple independent fundraising campaigns from a single interface.

## Architecture

### Key Components

1. **CampaignFactory Contract** (`contracts/crowdfunding/CampaignFactory.sol`)
   - Factory pattern for creating new campaigns
   - Tracks all created campaigns
   - Provides query functions for campaign discovery

2. **Frontend Campaign Management** (`dapp/src/App.tsx`)
   - Campaign list management with localStorage persistence
   - Campaign selection and switching
   - UI for adding/creating campaigns

3. **Campaign Operations**
   - All operations (contribute, withdraw, approve, etc.) work with the selected campaign
   - Campaign-specific state management

## How It Works

### 1. Campaign Storage

Campaigns are stored in two places:

**Frontend (localStorage):**
```typescript
const CAMPAIGNS_STORAGE_KEY = "crowdfunding_campaigns";

interface Campaign {
  address: string;
  name?: string;
}
```

Campaigns are persisted in the browser's localStorage, allowing users to maintain their campaign list across sessions.

**Smart Contract (Factory):**
The `CampaignFactory` contract maintains an on-chain registry of all campaigns created through it:
```solidity
address[] public campaigns;
mapping(address => bool) public isCampaign;
```

### 2. Campaign Initialization

On app load, campaigns are loaded from localStorage:

```typescript
useEffect(() => {
  const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as Campaign[];
    setCampaigns(parsed);
    // Auto-select first campaign if available
    if (parsed.length > 0 && !selectedCampaign) {
      setSelectedCampaign(parsed[0].address);
    }
  } else {
    // Initialize with default campaign from ADDRESSES
    if (ADDRESSES.crowd) {
      const defaultCampaigns = [{ address: ADDRESSES.crowd, name: "Default Campaign" }];
      setCampaigns(defaultCampaigns);
      setSelectedCampaign(ADDRESSES.crowd);
    }
  }
}, []);
```

### 3. Adding Campaigns

There are two ways to add campaigns:

#### Method 1: Manual Addition by Address
```typescript
function addCampaign(address: string, name?: string) {
  if (!ethers.isAddress(address)) {
    alert("Invalid address");
    return;
  }
  const normalized = address.toLowerCase();
  if (campaigns.find(c => c.address.toLowerCase() === normalized)) {
    alert("Campaign already exists");
    return;
  }
  const newCampaigns = [...campaigns, { address: normalized, name: name || `Campaign ${campaigns.length + 1}` }];
  setCampaigns(newCampaigns);
  if (!selectedCampaign) {
    setSelectedCampaign(normalized);
  }
}
```

#### Method 2: Create via Factory Contract
```typescript
async function createCampaignViaFactory() {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);

  const goalUnits = ethers.parseUnits(newCampaignGoal, tokenDecimals);
  const tx = await factory.createCampaign(
    ADDRESSES.token,
    goalUnits,
    ADDRESSES.sponsor,
    ADDRESSES.distribute
  );
  const receipt = await tx.wait();
  
  // Extract campaign address from event
  const event = receipt.logs.find(/* CampaignCreated event */);
  // Add to campaigns list
}
```

### 4. Campaign Selection

The selected campaign is stored in state:
```typescript
const [selectedCampaign, setSelectedCampaign] = useState<string>("");
```

All operations use the selected campaign address instead of a hardcoded address:

**Before (single campaign):**
```typescript
const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, signer);
```

**After (multiple campaigns):**
```typescript
const crowd = new ethers.Contract(selectedCampaign, crowdAbi, signer);
```

### 5. Campaign Operations

All campaign operations check for a selected campaign and use its address:

#### Example: Contribute Function
```typescript
async function contribute() {
  if (!selectedCampaign) {
    alert("Please select a campaign first");
    return;
  }
  
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
  const crowd = new ethers.Contract(selectedCampaign, crowdAbi, signer); // Uses selected campaign
  
  // Check state
  const stateStr: string = await crowd.getStateString();
  if (stateStr !== "nefinantat") {
    alert(`Nu mai poti contribui: campania este ${stateStr}.`);
    return;
  }
  
  // Check allowance for selected campaign
  const amountUnits = ethers.parseUnits(contributeAmount, tokenDecimals);
  const allowance: bigint = await token.allowance(account, selectedCampaign);
  
  if (allowance < amountUnits) {
    alert("Allowance insuficient. Fa approve inainte (sau mareste approve).");
    return;
  }
  
  const tx = await crowd.contribute(amountUnits);
  await tx.wait();
  
  await refreshAll();
}
```

#### Example: Approve Function
```typescript
async function approveCrowd() {
  if (!selectedCampaign) {
    alert("Please select a campaign first");
    return;
  }
  
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
  
  const amountUnits = ethers.parseUnits(approveAmount, tokenDecimals);
  // Approve for selected campaign, not hardcoded address
  const tx = await token.approve(selectedCampaign, amountUnits);
  await tx.wait();
  
  await refreshAll();
}
```

### 6. Data Refresh

The `refreshAll` function fetches data for the selected campaign:

```typescript
async function refreshAll(addr?: string) {
  const user = addr ?? account;
  if (!user || !selectedCampaign) return; // Requires selected campaign
  
  const provider = await getProvider();
  
  // Token data (shared across campaigns)
  const token = new ethers.Contract(ADDRESSES.token, tokenAbi, provider);
  // ... fetch token data ...
  
  // Campaign-specific data
  const crowd = new ethers.Contract(selectedCampaign, crowdAbi, provider);
  const [stateStr, goal, total, mine, ownerAddr] = await Promise.all([
    crowd.getStateString(),
    crowd.fundingGoal(),
    crowd.totalCollected(),
    crowd.contributions(user),
    crowd.owner(),
  ]);
  
  // Update state with campaign-specific data
  setCfOwner(ownerAddr);
  setCfState(stateStr);
  setCfGoal(ethers.formatUnits(goal, decimals));
  setCfTotal(ethers.formatUnits(total, decimals));
  setMyContribution(ethers.formatUnits(mine, decimals));
}
```

## Smart Contract: CampaignFactory

### Contract Structure

```solidity
contract CampaignFactory {
    address[] public campaigns;
    mapping(address => bool) public isCampaign;
    
    event CampaignCreated(
        address indexed campaign,
        address indexed owner,
        address indexed token,
        uint256 fundingGoal
    );
    
    function createCampaign(
        address token_,
        uint256 fundingGoal_,
        address sponsorFunding_,
        address distributeFunding_
    ) external returns (address) {
        CrowdFunding campaign = new CrowdFunding(
            token_,
            fundingGoal_,
            sponsorFunding_,
            distributeFunding_
        );
        
        address campaignAddress = address(campaign);
        campaigns.push(campaignAddress);
        isCampaign[campaignAddress] = true;
        
        emit CampaignCreated(campaignAddress, msg.sender, token_, fundingGoal_);
        return campaignAddress;
    }
    
    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }
    
    function getAllCampaigns() external view returns (address[] memory) {
        return campaigns;
    }
}
```

### Key Features

1. **Campaign Creation**: Deploys new `CrowdFunding` contracts
2. **Registry**: Maintains a list of all created campaigns
3. **Verification**: `isCampaign` mapping allows checking if an address is a valid campaign
4. **Query Functions**: Easy access to campaign count and list

## User Interface

### Campaign Selector

Users can select a campaign from a dropdown:
```tsx
<select
  value={selectedCampaign}
  onChange={(e) => setSelectedCampaign(e.target.value)}
>
  {campaigns.map((campaign) => (
    <option key={campaign.address} value={campaign.address}>
      {campaign.name || campaign.address} ({campaign.address.slice(0, 10)}...)
    </option>
  ))}
</select>
```

### Campaign List

Displays all campaigns with visual indication of the selected one:
```tsx
{campaigns.map((campaign) => (
  <li
    style={{
      backgroundColor: selectedCampaign.toLowerCase() === campaign.address.toLowerCase() 
        ? "#e3f2fd" 
        : "#f5f5f5"
    }}
  >
    <span>{campaign.name || "Unnamed"} - {campaign.address}</span>
    <button onClick={() => removeCampaign(campaign.address)}>Remove</button>
  </li>
))}
```

### Add Campaign Form

Two input methods:
1. **Manual Address Entry**: Directly add a campaign by its contract address
2. **Factory Creation**: Create a new campaign via the factory contract

## State Management

### Campaign State

```typescript
// Campaign list
const [campaigns, setCampaigns] = useState<Campaign[]>([]);

// Currently selected campaign
const [selectedCampaign, setSelectedCampaign] = useState<string>("");

// Campaign-specific data (updates when selectedCampaign changes)
const [cfState, setCfState] = useState<string>("-");
const [cfGoal, setCfGoal] = useState<string>("0");
const [cfTotal, setCfTotal] = useState<string>("0");
const [cfOwner, setCfOwner] = useState<string>("");
const [myContribution, setMyContribution] = useState<string>("0");
```

### Persistence

Campaigns are automatically saved to localStorage whenever the list changes:
```typescript
useEffect(() => {
  if (campaigns.length > 0) {
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
  }
}, [campaigns]);
```

## Key Design Decisions

### 1. localStorage vs On-Chain Registry

- **localStorage**: Fast, no gas costs, user-specific
- **Factory Registry**: On-chain, verifiable, discoverable by all users

The system uses both:
- localStorage for user's personal campaign list
- Factory registry for discovering campaigns created via the factory

### 2. Campaign Selection

All operations require a selected campaign. This ensures:
- Clear user intent
- Prevents accidental operations on wrong campaigns
- Better UX with explicit campaign context

### 3. Backward Compatibility

The system maintains compatibility with the original single-campaign setup:
- Default campaign from `ADDRESSES.crowd` is auto-added
- Existing operations work the same way
- No breaking changes to the contract interface

## Usage Flow

### Creating a New Campaign

1. **Via Factory**:
   ```
   User enters factory address → Enters funding goal → Clicks "Create Campaign"
   → Transaction sent → Campaign created → Automatically added to list
   ```

2. **Manual Addition**:
   ```
   User enters campaign address → Clicks "Add Campaign" → Campaign added to list
   ```

### Contributing to a Campaign

1. Select campaign from dropdown
2. Approve tokens for the selected campaign
3. Contribute tokens to the selected campaign
4. View contribution in campaign details

### Switching Between Campaigns

1. Select different campaign from dropdown
2. UI automatically refreshes with new campaign's data
3. All operations now target the newly selected campaign

## Important Notes

### Token Approvals

⚠️ **Important**: Token approvals are campaign-specific. If you approve tokens for Campaign A, you cannot use that approval for Campaign B. You must approve separately for each campaign.

```typescript
// Each campaign requires its own approval
await token.approve(campaignA, amount); // Approval for Campaign A
await token.approve(campaignB, amount); // Separate approval for Campaign B
```

### Campaign Ownership

Each campaign has its own owner. The `isOwner` check is campaign-specific:
```typescript
const isOwner = account && cfOwner && 
  account.toLowerCase() === cfOwner.toLowerCase();
```

This means you can be the owner of Campaign A but not Campaign B.

### DistributeFunding Relationship

The `DistributeFunding` contract can be associated with a specific campaign via `setCrowdFunding()`. However, in the current implementation, there's a single `DistributeFunding` contract. For true multi-campaign support, you might want to deploy separate `DistributeFunding` contracts per campaign or use a more sophisticated distribution system.

## Future Enhancements

Potential improvements:

1. **Campaign Discovery**: Query factory for all campaigns and display them
2. **Campaign Metadata**: Store campaign name, description, etc. on-chain
3. **Campaign Filtering**: Filter campaigns by state, goal, etc.
4. **Campaign Statistics**: Aggregate statistics across all campaigns
5. **Multi-DistributeFunding**: Support different distribution contracts per campaign

## Code Files Reference

- **Factory Contract**: `contracts/crowdfunding/CampaignFactory.sol`
- **Factory ABI**: `dapp/src/contracts/factoryAbi.ts`
- **Main App**: `dapp/src/App.tsx` (lines 12-300+ for campaign management)
- **Deploy Script**: `scripts/deploy.ts` (includes factory deployment)

## Testing

To test the multiple campaign system:

1. Deploy contracts: `npx hardhat run scripts/deploy.ts --network localhost`
2. Note the factory address from deployment output
3. Start the dapp: `cd dapp && npm run dev`
4. Connect wallet
5. Add factory address and create a new campaign
6. Switch between campaigns and verify operations work correctly
