import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "./contracts/addresses";
import { tokenAbi } from "./contracts/tokenAbi";
import { crowdAbi } from "./contracts/crowdAbi";
import { sponsorAbi } from "./contracts/sponsorAbi";
import { distributeAbi } from "./contracts/distributeAbi";
import { factoryAbi } from "./contracts/factoryAbi";
import TokenPage from "./TokenPage";

type Page = "main" | "token";

interface Campaign {
  address: string;
  name?: string;
}

const CAMPAIGNS_STORAGE_KEY = "crowdfunding_campaigns";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("main");
  const [account, setAccount] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("");

  // Campaign management
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [viewingCampaign, setViewingCampaign] = useState<string>(""); // Campaign being viewed
  const [newCampaignAddress, setNewCampaignAddress] = useState<string>("");
  const [factoryAddress, setFactoryAddress] = useState<string>(ADDRESSES.factory || "");
  const [newCampaignGoal, setNewCampaignGoal] = useState<string>("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [campaignOwners, setCampaignOwners] = useState<Record<string, string>>({}); // campaign address -> owner address

  // Token
  const [tokenSymbol, setTokenSymbol] = useState<string>("EDU");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [pricePerToken, setPricePerToken] = useState<string>("");

  // Crowdfunding
  const [cfState, setCfState] = useState<string>("-");
  const [cfGoal, setCfGoal] = useState<string>("0");
  const [cfTotal, setCfTotal] = useState<string>("0");
  const [myContribution, setMyContribution] = useState<string>("0");

  const [approveAmount, setApproveAmount] = useState<string>("");
  const [contributeAmount, setContributeAmount] = useState<string>("");

  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [contributing, setContributing] = useState(false);

  // Withdraw
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState(false);

  // Owner gating + actions
  const [cfOwner, setCfOwner] = useState<string>("");
  const [sponsorBuyAmount, setSponsorBuyAmount] = useState<string>("");

  const [requestingSponsor, setRequestingSponsor] = useState(false);
  const [transferringDist, setTransferringDist] = useState(false);
  const [buyingSponsor, setBuyingSponsor] = useState(false);

  const isOwner =
    account && cfOwner && account.toLowerCase() === cfOwner.toLowerCase();


  // Distribute (beneficiari)
  const [benAddress, setBenAddress] = useState<string>("");
  const [benWeight, setBenWeight] = useState<string>(""); // bps: ex 6000 = 60%
  const [addingBen, setAddingBen] = useState(false);

  const [totalWeightBps, setTotalWeightBps] = useState<string>("0");
  const [benCount, setBenCount] = useState<string>("0");

  // Validate campaign exists on blockchain
  async function validateCampaign(address: string): Promise<boolean> {
    try {
      const provider = await getProvider();
      const code = await provider.getCode(address);
      return code !== "0x" && code !== "0x0";
    } catch {
      return false;
    }
  }

  // Load and validate campaigns from localStorage on mount
  useEffect(() => {
    async function loadAndValidateCampaigns() {
      const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Campaign[];
          
          // Validate all campaigns exist on blockchain
          const validatedCampaigns: Campaign[] = [];
          for (const campaign of parsed) {
            const isValid = await validateCampaign(campaign.address);
            if (isValid) {
              validatedCampaigns.push(campaign);
            } else {
              console.log(`Removed invalid campaign: ${campaign.address} (does not exist on blockchain)`);
            }
          }
          
          // Update campaigns list with only valid ones
          let finalCampaigns = validatedCampaigns;
          
          // If there's a default campaign in ADDRESSES, add it if not present
          if (ADDRESSES.crowd && !finalCampaigns.find(c => c.address.toLowerCase() === ADDRESSES.crowd.toLowerCase())) {
            const defaultExists = await validateCampaign(ADDRESSES.crowd);
            if (defaultExists) {
              finalCampaigns = [{ address: ADDRESSES.crowd, name: "Default Campaign" }, ...finalCampaigns];
              setSelectedCampaign(ADDRESSES.crowd);
            }
          } else if (finalCampaigns.length > 0 && !selectedCampaign) {
            setSelectedCampaign(finalCampaigns[0].address);
          }
          
          setCampaigns(finalCampaigns);
          localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(finalCampaigns));
        } catch (e) {
          console.error("Failed to load campaigns from storage", e);
        }
      } else {
        // Initialize with default campaign if available
        if (ADDRESSES.crowd) {
          const defaultExists = await validateCampaign(ADDRESSES.crowd);
          if (defaultExists) {
            const defaultCampaigns = [{ address: ADDRESSES.crowd, name: "Default Campaign" }];
            setCampaigns(defaultCampaigns);
            setSelectedCampaign(ADDRESSES.crowd);
            localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(defaultCampaigns));
          }
        }
      }
    }
    
    loadAndValidateCampaigns();
  }, []);

  // Save campaigns to localStorage whenever they change
  useEffect(() => {
    if (campaigns.length > 0) {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
    }
  }, [campaigns]);

  // Load campaign owners when campaigns change and account is connected
  useEffect(() => {
    if (account && campaigns.length > 0) {
      loadCampaignOwners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, campaigns.length]); // Only depend on length to avoid infinite loops

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return "Unknown error";
  }

  async function getProvider() {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    return new ethers.BrowserProvider(window.ethereum);
  }

  async function loadCampaignOwners() {
    if (campaigns.length === 0) return;
    
    try {
      const provider = await getProvider();
      const owners: Record<string, string> = {};
      
      // Load owners for all campaigns in parallel
      await Promise.allSettled(
        campaigns.map(async (campaign) => {
          const normalized = campaign.address.toLowerCase();
          // Skip if already loaded
          if (campaignOwners[normalized]) {
            owners[normalized] = campaignOwners[normalized];
            return;
          }
          
          try {
            // First check if address has code (is a contract)
            const code = await provider.getCode(normalized);
            if (code === "0x" || code === "0x0") {
              // Not a contract, skip silently
              return;
            }
            
            const crowd = new ethers.Contract(normalized, crowdAbi, provider);
            const owner = await crowd.owner();
            owners[normalized] = owner.toLowerCase();
          } catch (err: unknown) {
            // Silently skip invalid contracts - don't spam console
            const errorMsg = err instanceof Error ? err.message : String(err);
            // Only log if it's not a "missing revert data" or "CALL_EXCEPTION" error
            if (!errorMsg.includes("missing revert data") && 
                !errorMsg.includes("CALL_EXCEPTION") &&
                !errorMsg.includes("execution reverted")) {
              console.warn(`Could not load owner for campaign ${normalized}:`, errorMsg);
            }
            // Don't set owner if it fails - button will remain disabled
          }
        })
      );
      
      // Only update if we found any owners
      if (Object.keys(owners).length > 0) {
        setCampaignOwners(prev => ({ ...prev, ...owners }));
      }
    } catch (err) {
      console.error("Failed to load campaign owners:", err);
    }
  }

  async function connectWallet() {
    if (connecting) return;

    try {
      setConnecting(true);

      const provider = await getProvider();
      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const bal = await provider.getBalance(addr);

      setAccount(addr);
      setEthBalance(ethers.formatEther(bal));

      await refreshAll(addr);
      // Load owners for all campaigns after connecting wallet
      await loadCampaignOwners();
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }

  async function refreshAll(addr?: string, campaignAddr?: string) {
    const user = addr ?? account;
    const campaign = campaignAddr ?? selectedCampaign ?? viewingCampaign;
    if (!user || !campaign) return;

    try {
      setLoading(true);

      const provider = await getProvider();

      // Validate token address exists
      if (!ADDRESSES.token || !ethers.isAddress(ADDRESSES.token)) {
        throw new Error("Token address is not configured. Please redeploy contracts.");
      }
      
      const tokenCode = await provider.getCode(ADDRESSES.token);
      if (tokenCode === "0x") {
        throw new Error(`Token contract does not exist at address ${ADDRESSES.token}. Please redeploy contracts.`);
      }

      // Token (read-only)
      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, provider);

      const [sym, dec, bal, ppu] = await Promise.all([
        token.symbol(),
        token.decimals(),
        token.balanceOf(user),
        token.pricePerUnitWei(),
      ]);

      const decimals = Number(dec);

      setTokenSymbol(sym);
      setTokenDecimals(decimals);
      setTokenBalance(ethers.formatUnits(bal, decimals));

      // pricePerUnitWei este "pret pe unitate minima"; convertim la pret per 1 token:
      const pricePerTokenWei = BigInt(ppu) * (BigInt(10) ** BigInt(decimals));
      setPricePerToken(ethers.formatEther(pricePerTokenWei));

      // Validate campaign address exists
      if (!campaign || !ethers.isAddress(campaign)) {
        throw new Error("Invalid campaign address.");
      }
      
      const campaignCode = await provider.getCode(campaign);
      if (campaignCode === "0x") {
        throw new Error(`Campaign contract does not exist at address ${campaign}. Please check the address or create a new campaign.`);
      }

      // CrowdFunding (read-only) - use campaign parameter or selected/viewing campaign
      const crowd = new ethers.Contract(campaign, crowdAbi, provider);

      const [stateStr, goal, total, mine, ownerAddr] = await Promise.all([
        crowd.getStateString(),
        crowd.fundingGoal(),
        crowd.totalCollected(),
        crowd.contributions(user),
        crowd.owner(),
      ]);

      setCfOwner(ownerAddr);
      setCfState(stateStr);
      setCfGoal(ethers.formatUnits(goal, decimals));
      setCfTotal(ethers.formatUnits(total, decimals));
      setMyContribution(ethers.formatUnits(mine, decimals));

      // Validate distribute address exists
      if (!ADDRESSES.distribute || !ethers.isAddress(ADDRESSES.distribute)) {
        throw new Error("DistributeFunding address is not configured. Please redeploy contracts.");
      }
      
      const distCode = await provider.getCode(ADDRESSES.distribute);
      if (distCode === "0x") {
        throw new Error(`DistributeFunding contract does not exist at address ${ADDRESSES.distribute}. Please redeploy contracts.`);
      }

      // DistributeFunding (read-only)
      const dist = new ethers.Contract(ADDRESSES.distribute, distributeAbi, provider);

      // count e sigur
      const count = await dist.beneficiariesCount();
      setBenCount(count.toString());

      // totalWeightBps poate sa nu existe in contract -> fallback N/A
      try {
        const tw = await dist.totalWeightBps();
        setTotalWeightBps(tw.toString());
      } catch {
        setTotalWeightBps("N/A");
      }

      // ETH
      const eth = await provider.getBalance(user);
      setEthBalance(ethers.formatEther(eth));
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function addCampaign(address: string, name?: string) {
    if (!address || address.trim() === "") {
      alert("Please enter a campaign address");
      return;
    }
    
    if (!ethers.isAddress(address)) {
      alert("Invalid address format. Please enter a valid Ethereum address (starting with 0x)");
      return;
    }
    
    const normalized = address.toLowerCase();
    if (campaigns.find(c => c.address.toLowerCase() === normalized)) {
      alert("This campaign is already in your list");
      return;
    }
    
    // Verify that the address is actually a CrowdFunding contract
    try {
      const provider = await getProvider();
      
      // First check if address has code (is a contract)
      const code = await provider.getCode(normalized);
      if (code === "0x" || code === "0x0") {
        alert("Error: This address is not a contract. Please check the address and try again.");
        return;
      }
      
      const crowd = new ethers.Contract(normalized, crowdAbi, provider);
      
      // Try to read owner to verify it's a valid CrowdFunding contract
      const owner = await crowd.owner();
      setCampaignOwners(prev => ({ ...prev, [normalized]: owner.toLowerCase() }));
      
      // Also verify it has the expected functions
      await crowd.fundingGoal().catch(() => {
        throw new Error("This address does not appear to be a valid CrowdFunding contract");
      });
      
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (errorMsg.includes("does not appear to be a valid")) {
        alert(`Error: ${errorMsg}`);
        return;
      } else if (errorMsg.includes("call revert exception") || 
                 errorMsg.includes("execution reverted") ||
                 errorMsg.includes("missing revert data") ||
                 errorMsg.includes("CALL_EXCEPTION")) {
        alert("Error: This address does not appear to be a valid CrowdFunding contract.\n" +
              "The contract might not be deployed on this network or the address might be incorrect.\n\n" +
              "Please check:\n" +
              "1. The address is correct\n" +
              "2. The contract is deployed on the current network\n" +
              "3. You are connected to the correct network in MetaMask");
        return;
      } else {
        console.error("Failed to fetch campaign owner:", err);
        // Ask user if they want to add it anyway
        const proceed = confirm(
          "Warning: Could not verify this is a valid CrowdFunding contract.\n" +
          "The address might be invalid or the contract might not be deployed.\n\n" +
          "Do you want to add it anyway?"
        );
        if (!proceed) {
          return;
        }
      }
    }
    
    const newCampaigns = [...campaigns, { address: normalized, name: name || `Campaign ${campaigns.length + 1}` }];
    setCampaigns(newCampaigns);
    setNewCampaignAddress("");
    alert(`Campaign added successfully!`);
  }

  async function viewCampaign(address: string) {
    setViewingCampaign(address);
    setSelectedCampaign(address); // Also set as selected for operations
    
    // Fetch and store owner if not already loaded
    const normalized = address.toLowerCase();
    if (!campaignOwners[normalized]) {
      try {
        const provider = await getProvider();
        const crowd = new ethers.Contract(normalized, crowdAbi, provider);
        const owner = await crowd.owner();
        setCampaignOwners(prev => ({ ...prev, [normalized]: owner.toLowerCase() }));
      } catch (err) {
        console.error("Failed to fetch campaign owner:", err);
      }
    }
    
    refreshAll(account, address);
  }

  function closeCampaignView() {
    setViewingCampaign("");
    // Keep selectedCampaign for operations, but clear viewing state
  }

  async function removeCampaign(address: string) {
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }

    const normalized = address.toLowerCase();
    const campaignOwner = campaignOwners[normalized];
    
    // Check if user is the owner
    if (campaignOwner && account.toLowerCase() !== campaignOwner) {
      alert("Only the campaign owner can remove this campaign from the list");
      return;
    }

    // If owner not loaded yet, try to fetch it
    if (!campaignOwner) {
      try {
        const provider = await getProvider();
        const crowd = new ethers.Contract(normalized, crowdAbi, provider);
        const owner = await crowd.owner();
        const ownerLower = owner.toLowerCase();
        
        if (account.toLowerCase() !== ownerLower) {
          alert("Only the campaign owner can remove this campaign from the list");
          return;
        }
        
        setCampaignOwners(prev => ({ ...prev, [normalized]: ownerLower }));
      } catch (err) {
        console.error("Failed to verify owner:", err);
        alert("Could not verify campaign ownership. Please try again.");
        return;
      }
    }

    const newCampaigns = campaigns.filter(c => c.address.toLowerCase() !== normalized);
    setCampaigns(newCampaigns);
    const newOwners = { ...campaignOwners };
    delete newOwners[normalized];
    setCampaignOwners(newOwners);
    
    if (selectedCampaign.toLowerCase() === normalized) {
      setSelectedCampaign(newCampaigns.length > 0 ? newCampaigns[0].address : "");
    }
    if (viewingCampaign.toLowerCase() === normalized) {
      setViewingCampaign("");
    }
  }

  async function createCampaignViaFactory() {
    if (!factoryAddress || !ethers.isAddress(factoryAddress)) {
      alert("Invalid factory address");
      return;
    }
    if (!newCampaignGoal || Number(newCampaignGoal) <= 0) {
      alert("Invalid funding goal");
      return;
    }

    try {
      setCreatingCampaign(true);
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);

      const goalUnits = ethers.parseUnits(newCampaignGoal, tokenDecimals);
      
      // Get the signer address (the one creating the campaign)
      const signerAddress = await signer.getAddress();
      
      const tx = await factory.createCampaign(
        ADDRESSES.token,
        goalUnits,
        ADDRESSES.sponsor,
        ADDRESSES.distribute
      );
      const receipt = await tx.wait();

      // Find the CampaignCreated event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === "CampaignCreated";
        } catch {
          return false;
        }
      });

      let campaignAddress: string | null = null;
      
      if (event) {
        const parsed = factory.interface.parseLog(event);
        campaignAddress = parsed?.args[0];
      } else {
        // Fallback: query the factory for the latest campaign
        const allCampaigns = await factory.getAllCampaigns();
        if (allCampaigns.length > 0) {
          campaignAddress = allCampaigns[allCampaigns.length - 1];
        }
      }

      if (campaignAddress) {
        const normalized = campaignAddress.toLowerCase();
        
        // Verify owner from contract to be 100% sure
        try {
          const crowd = new ethers.Contract(normalized, crowdAbi, provider);
          const contractOwner = await crowd.owner();
          const ownerLower = contractOwner.toLowerCase();
          
          // Set the owner from contract (should be the signer)
          setCampaignOwners(prev => ({ ...prev, [normalized]: ownerLower }));
          
          // Verify it matches the signer
          if (ownerLower !== signerAddress.toLowerCase()) {
            console.warn(`Owner mismatch: contract owner is ${ownerLower}, but signer is ${signerAddress.toLowerCase()}`);
          }
        } catch (err) {
          console.error("Failed to verify owner from contract:", err);
          // Fallback: use signer address
          setCampaignOwners(prev => ({ ...prev, [normalized]: signerAddress.toLowerCase() }));
        }
        
        // Set this campaign in DistributeFunding so it can call notifyFundsReceived
        // Note: This will overwrite any previous campaign setting, but that's OK for now
        // A better solution would be to not set crowdFunding at all (leave it as address(0))
        try {
          const dist = new ethers.Contract(ADDRESSES.distribute, distributeAbi, signer);
          const currentCrowdFunding = await dist.crowdFunding();
          
          // Only set if it's not already set to this campaign
          if (currentCrowdFunding.toLowerCase() !== normalized) {
            const setTx = await dist.setCrowdFunding(normalized);
            await setTx.wait();
            console.log(`Set DistributeFunding.crowdFunding to ${normalized}`);
          }
        } catch (err) {
          console.warn("Failed to set crowdFunding in DistributeFunding:", err);
          // Continue anyway - the user can set it manually if needed
        }
        
        await addCampaign(campaignAddress, `Campaign ${campaigns.length + 1}`);
        setNewCampaignGoal("");
        alert(`Campaign created: ${campaignAddress}\nYou are now the owner of this campaign.`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setCreatingCampaign(false);
    }
  }



  async function approveCrowd() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    if (!approveAmount || Number(approveAmount) <= 0) {
      alert("Introdu o suma valida pentru approve");
      return;
    }

    try {
      setApproving(true);

      const provider = await getProvider();
      
      // Validate campaign exists
      if (!ethers.isAddress(campaignAddress)) {
        throw new Error("Invalid campaign address");
      }
      
      const campaignCode = await provider.getCode(campaignAddress);
      if (campaignCode === "0x") {
        throw new Error(`Campaign contract does not exist at address ${campaignAddress}. Please check the address.`);
      }

      const signer = await provider.getSigner();

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);

      const amountUnits = ethers.parseUnits(approveAmount, tokenDecimals);
      const tx = await token.approve(campaignAddress, amountUnits);
      await tx.wait();

      await refreshAll(undefined, campaignAddress);
      setApproveAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  async function contribute() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    if (!contributeAmount || Number(contributeAmount) <= 0) {
      alert("Introdu o suma valida pentru contribute");
      return;
    }

    try {
      setContributing(true);

      const provider = await getProvider();
      
      // Validate campaign exists
      if (!ethers.isAddress(campaignAddress)) {
        throw new Error("Invalid campaign address");
      }
      
      const campaignCode = await provider.getCode(campaignAddress);
      if (campaignCode === "0x") {
        throw new Error(`Campaign contract does not exist at address ${campaignAddress}. Please check the address.`);
      }

      const signer = await provider.getSigner();

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
      const crowd = new ethers.Contract(campaignAddress, crowdAbi, signer);

      // 1) verifica starea inainte (mesaj corect pentru profesor)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "nefinantat") {
        if (stateStr === "prefinantat") {
          alert(`❌ Cannot contribute. The campaign goal has been reached.\n\nCurrent state: "${stateStr}"\n\nContributions are no longer accepted. The owner can now request sponsorship.`);
        } else if (stateStr === "finantat") {
          alert(`❌ Cannot contribute. The campaign has been finalized.\n\nCurrent state: "${stateStr}"\n\nContributions are no longer accepted.`);
        } else {
          alert(`❌ Cannot contribute. Campaign state is "${stateStr}".\n\nContributions are only allowed when the campaign state is "nefinantat".`);
        }
        return;
      }

      // 2) Verifică balance-ul de tokeni
      const tokenBalance: bigint = await token.balanceOf(account);
      const amountUnits = ethers.parseUnits(contributeAmount, tokenDecimals);
      
      if (tokenBalance < amountUnits) {
        alert(`❌ Insufficient token balance.\n\nYou have: ${ethers.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}\nYou need: ${contributeAmount} ${tokenSymbol}\n\nPlease buy more tokens first.`);
        return;
      }

      // 3) Verifică allowance
      const allowance: bigint = await token.allowance(account, campaignAddress);

      if (allowance < amountUnits) {
        alert(`❌ Insufficient allowance.\n\nCurrent allowance: ${ethers.formatUnits(allowance, tokenDecimals)} ${tokenSymbol}\nRequired: ${contributeAmount} ${tokenSymbol}\n\nPlease approve tokens first (or increase approval amount).`);
        return;
      }

      // 4) Apelează funcția reală
      const tx = await crowd.contribute(amountUnits);
      await tx.wait();

      await refreshAll(undefined, campaignAddress);
      setContributeAmount("");
    } catch (err: unknown) {
      console.error("Contribute error:", err);
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      // User-friendly error messages
      if (errorMsg.includes("missing revert data") || errorMsg.includes("CALL_EXCEPTION")) {
        alert(`❌ Transaction failed. Possible causes:\n\n1. Campaign contract does not exist at this address\n2. Campaign contract is not a valid CrowdFunding contract\n3. Network mismatch (check if you're on the correct network)\n4. Contract state prevents contribution\n\nCampaign address: ${campaignAddress}\n\nPlease verify the campaign address and try again.`);
      } else if (errorMsg.includes("user rejected") || errorMsg.includes("denied") || errorMsg.includes("User rejected")) {
        alert("Transaction was cancelled by user.");
      } else if (errorMsg.includes("insufficient funds") || errorMsg.includes("Insufficient")) {
        alert("❌ Insufficient funds. Please check your token balance and allowance.");
      } else if (errorMsg.includes("not allowed") || errorMsg.includes("state")) {
        alert(`❌ Cannot contribute. Campaign state does not allow contributions.\n\nError: ${errorMsg}`);
      } else if (errorMsg.includes("transferFrom failed") || errorMsg.includes("allowance")) {
        alert(`❌ Token transfer failed. Please check your token balance and allowance.\n\nError: ${errorMsg}`);
      } else {
        alert(`❌ Error contributing: ${errorMsg}\n\nPlease check:\n- Campaign address is correct\n- You have enough tokens\n- You have approved enough tokens\n- Campaign state allows contributions`);
      }
    } finally {
      setContributing(false);
    }
  }

  async function withdraw() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      alert("Introdu o suma valida pentru withdraw");
      return;
    }

    try {
      setWithdrawing(true);

      const provider = await getProvider();
      
      // Validate campaign exists
      if (!ethers.isAddress(campaignAddress)) {
        throw new Error("Invalid campaign address");
      }
      
      const campaignCode = await provider.getCode(campaignAddress);
      if (campaignCode === "0x") {
        throw new Error(`Campaign contract does not exist at address ${campaignAddress}. Please check the address.`);
      }

      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(campaignAddress, crowdAbi, provider);

      // verifica starea inainte (altfel MetaMask arata erori urate)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "nefinantat") {
        if (stateStr === "prefinantat") {
          alert(`❌ Cannot withdraw. The campaign goal has been reached.\n\nCurrent state: "${stateStr}"\n\nWithdrawals are no longer allowed. The owner can now request sponsorship.`);
        } else if (stateStr === "finantat") {
          alert(`❌ Cannot withdraw. The campaign has been finalized.\n\nCurrent state: "${stateStr}"\n\nWithdrawals are no longer allowed.`);
        } else {
          alert(`❌ Cannot withdraw. Campaign state is "${stateStr}".\n\nWithdrawals are only allowed when the campaign state is "nefinantat".`);
        }
        return;
      }

      // Check user's contribution before attempting withdrawal
      const userContribution: bigint = await crowd.contributions(account);
      const amountUnits = ethers.parseUnits(withdrawAmount, tokenDecimals);
      
      if (userContribution < amountUnits) {
        const available = ethers.formatUnits(userContribution, tokenDecimals);
        alert(`❌ Insufficient contribution to withdraw.\n\nYour contribution: ${available} ${tokenSymbol}\nYou tried to withdraw: ${withdrawAmount} ${tokenSymbol}\n\nYou can only withdraw up to ${available} ${tokenSymbol}.`);
        return;
      }

      if (userContribution === 0n) {
        alert(`❌ You have no contributions to withdraw.\n\nYour contribution: 0 ${tokenSymbol}\n\nYou need to contribute first before you can withdraw.`);
        return;
      }

      const crowdWithSigner = new ethers.Contract(campaignAddress, crowdAbi, signer);
      const tx = await crowdWithSigner.withdraw(amountUnits);
      await tx.wait();

      await refreshAll(undefined, campaignAddress);
      setWithdrawAmount("");
    } catch (err: unknown) {
      console.error("Withdraw error:", err);
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      // User-friendly error messages
      if (errorMsg.includes("insufficient contribution")) {
        // Get user's contribution to show in error message
        try {
          const provider = await getProvider();
          const crowd = new ethers.Contract(campaignAddress, crowdAbi, provider);
          const userContribution: bigint = await crowd.contributions(account);
          const available = ethers.formatUnits(userContribution, tokenDecimals);
          alert(`❌ Insufficient contribution to withdraw.\n\nYour contribution: ${available} ${tokenSymbol}\nYou tried to withdraw: ${withdrawAmount} ${tokenSymbol}\n\nYou can only withdraw up to ${available} ${tokenSymbol}.`);
        } catch {
          alert(`❌ Insufficient contribution to withdraw.\n\nYou tried to withdraw: ${withdrawAmount} ${tokenSymbol}\n\nYou can only withdraw up to the amount you contributed.`);
        }
      } else if (errorMsg.includes("user rejected") || errorMsg.includes("denied") || errorMsg.includes("User rejected")) {
        alert("Transaction was cancelled by user.");
      } else if (errorMsg.includes("not allowed") || errorMsg.includes("state")) {
        alert(`❌ Cannot withdraw. Campaign state does not allow withdrawals.\n\nError: ${errorMsg}`);
      } else if (errorMsg.includes("transfer failed")) {
        alert(`❌ Token transfer failed. The campaign may not have enough tokens.\n\nError: ${errorMsg}`);
      } else if (errorMsg.includes("missing revert data") || errorMsg.includes("CALL_EXCEPTION")) {
        alert(`❌ Transaction failed. Possible causes:\n\n1. Campaign contract does not exist at this address\n2. Campaign contract is not a valid CrowdFunding contract\n3. Network mismatch\n4. Contract state prevents withdrawal\n\nCampaign address: ${campaignAddress}\n\nPlease verify the campaign address and try again.`);
      } else {
        alert(`❌ Error withdrawing: ${errorMsg}\n\nPlease check:\n- Campaign address is correct\n- You have contributed to this campaign\n- Campaign state allows withdrawals\n- Withdrawal amount does not exceed your contribution`);
      }
    } finally {
      setWithdrawing(false);
    }
  }

  async function buySponsorTokens() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }
    
    if (!sponsorBuyAmount || Number(sponsorBuyAmount) <= 0) {
      alert("Please enter a valid amount for sponsor tokens");
      return;
    }
    
    // Verify ownership of the campaign (not SponsorFunding)
    // buySponsorTokens is available for campaign owner at any time
    try {
      const provider = await getProvider();
      const crowd = new ethers.Contract(campaignAddress, crowdAbi, provider);
      const campaignOwner = await crowd.owner();
      
      if (account.toLowerCase() !== campaignOwner.toLowerCase()) {
        alert("❌ Only the campaign owner can buy sponsor tokens.\n\nYou are not the owner of this campaign.");
        return;
      }
    } catch (err) {
      alert("❌ Could not verify campaign ownership. Please try again.");
      return;
    }

    try {
      setBuyingSponsor(true);

      const provider = await getProvider();
      
      // Validate contracts exist
      if (!ADDRESSES.token || !ethers.isAddress(ADDRESSES.token)) {
        throw new Error("Token address is not configured. Please redeploy contracts.");
      }
      
      if (!ADDRESSES.sponsor || !ethers.isAddress(ADDRESSES.sponsor)) {
        throw new Error("SponsorFunding address is not configured. Please redeploy contracts.");
      }
      
      const tokenCode = await provider.getCode(ADDRESSES.token);
      if (tokenCode === "0x") {
        throw new Error("Token contract does not exist. Please redeploy contracts.");
      }
      
      const sponsorCode = await provider.getCode(ADDRESSES.sponsor);
      if (sponsorCode === "0x") {
        throw new Error("SponsorFunding contract does not exist. Please redeploy contracts.");
      }

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, provider);

      const amountUnits = ethers.parseUnits(sponsorBuyAmount, tokenDecimals);

      const ppu: bigint = await token.pricePerUnitWei();
      const costWei = amountUnits * ppu;
      
      // Check if user has enough ETH
      const balance = await provider.getBalance(account);
      if (balance < costWei) {
        throw new Error(`Insufficient ETH balance. You need ${ethers.formatEther(costWei)} ETH but you have ${ethers.formatEther(balance)} ETH.`);
      }
      
      // Check if Token contract has enough tokens available
      const tokenBalance = await token.balanceOf(ADDRESSES.token);
      if (tokenBalance < amountUnits) {
        throw new Error(`Token contract does not have enough tokens available. Available: ${ethers.formatUnits(tokenBalance, tokenDecimals)} ${tokenSymbol}, Required: ${sponsorBuyAmount} ${tokenSymbol}`);
      }

      const signer = await provider.getSigner();
      const sponsorWithSigner = new ethers.Contract(ADDRESSES.sponsor, sponsorAbi, signer);
      const tx = await sponsorWithSigner.buySponsorTokens(amountUnits, { value: costWei });
      await tx.wait();

      // Refresh all data (buySponsorTokens doesn't depend on a specific campaign)
      await refreshAll();
      setSponsorBuyAmount("");
      alert("✅ Sponsor tokens purchased successfully!");
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = getErrorMessage(err);
      
      // User-friendly error messages
      if (errorMsg.includes("insufficient funds") || errorMsg.includes("Insufficient")) {
        if (errorMsg.includes("ETH")) {
          alert(`❌ Insufficient ETH balance.\n\n${errorMsg}`);
        } else if (errorMsg.includes("tokens available")) {
          alert(`❌ Token contract does not have enough tokens.\n\n${errorMsg}`);
        } else {
          alert("❌ Insufficient funds. Please check your ETH balance.");
        }
      } else if (errorMsg.includes("user rejected") || errorMsg.includes("denied") || errorMsg.includes("User rejected")) {
        alert("Transaction was cancelled by user.");
      } else if (errorMsg.includes("revert") || errorMsg.includes("execution reverted")) {
        if (errorMsg.includes("amount=0")) {
          alert("❌ Invalid amount. Please enter a valid amount greater than 0.");
        } else if (errorMsg.includes("bad value") || errorMsg.includes("value")) {
          alert("❌ Invalid ETH value sent. The amount of ETH sent does not match the required cost.");
        } else if (errorMsg.includes("not enough tokens")) {
          alert("❌ Token contract does not have enough tokens available for purchase.");
        } else {
          alert(`❌ Transaction failed. The contract rejected the operation.\n\nError: ${errorMsg}\n\nPlease check:\n- You have enough ETH\n- Token contract has enough tokens\n- Amount is valid`);
        }
      } else if (errorMsg.includes("missing revert data") || errorMsg.includes("CALL_EXCEPTION")) {
        alert(`❌ Cannot estimate gas. Possible causes:\n\n1. Token contract does not exist\n2. SponsorFunding contract does not exist\n3. Network mismatch\n4. Invalid contract addresses\n\nPlease verify the contract addresses and try again.`);
      } else {
        alert(`❌ Error buying sponsor tokens: ${errorMsg}\n\nPlease check:\n- You have enough ETH\n- Token contract has enough tokens\n- Amount is valid`);
      }
    } finally {
      setBuyingSponsor(false);
    }
  }

  async function requestSponsorship() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      setRequestingSponsor(true);

      const provider = await getProvider();
      
      // Validate campaign exists
      if (!ethers.isAddress(campaignAddress)) {
        throw new Error("Invalid campaign address");
      }
      
      const campaignCode = await provider.getCode(campaignAddress);
      if (campaignCode === "0x") {
        throw new Error("Campaign contract does not exist. Please check the address or create a new campaign.");
      }

      const crowd = new ethers.Contract(campaignAddress, crowdAbi, provider);
      
      // Verify ownership
      const owner = await crowd.owner();
      if (account.toLowerCase() !== owner.toLowerCase()) {
        alert("❌ Only the campaign owner can request sponsorship.\n\nYou are not the owner of this campaign.");
        return;
      }
      
      // Check campaign state - sponsorship can only be requested when campaign is "prefinantat" (goal reached but not yet sponsored)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "prefinantat") {
        if (stateStr === "nefinantat") {
          alert(`❌ Cannot request sponsorship. The campaign goal has not been reached yet.\n\nCurrent state: "${stateStr}"\n\nPlease wait until the funding goal is reached.`);
        } else if (stateStr === "finantat") {
          alert(`❌ Sponsorship has already been requested for this campaign.\n\nCurrent state: "${stateStr}"\n\nYou can now transfer funds to distribution.`);
        } else {
          alert(`❌ Cannot request sponsorship. Campaign state must be "prefinantat" (goal reached), but it is currently "${stateStr}".`);
        }
        return;
      }

      const signer = await provider.getSigner();
      const crowdWithSigner = new ethers.Contract(campaignAddress, crowdAbi, signer);

      const tx = await crowdWithSigner.requestSponsorship();
      await tx.wait();

      await refreshAll(undefined, campaignAddress);
      alert("✅ Sponsorship requested successfully!");
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = getErrorMessage(err);
      
      // User-friendly error messages
      if (errorMsg.includes("user rejected") || errorMsg.includes("denied")) {
        alert("Transaction was cancelled by user.");
      } else if (errorMsg.includes("revert") || errorMsg.includes("execution reverted")) {
        alert("❌ Transaction failed. The contract rejected the operation. Please check:\n- Campaign state must be 'finantat' (funded)\n- Campaign must have reached its funding goal");
      } else if (errorMsg.includes("Only the campaign owner")) {
        // Already handled above
      } else {
        alert(`❌ Error requesting sponsorship: ${errorMsg}`);
      }
    } finally {
      setRequestingSponsor(false);
    }
  }

  async function transferToDistribute() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      setTransferringDist(true);

      const provider = await getProvider();
      
      // Validate campaign exists
      if (!ethers.isAddress(campaignAddress)) {
        throw new Error("Invalid campaign address");
      }
      
      const campaignCode = await provider.getCode(campaignAddress);
      if (campaignCode === "0x") {
        throw new Error("Campaign contract does not exist. Please check the address or create a new campaign.");
      }

      const crowd = new ethers.Contract(campaignAddress, crowdAbi, provider);
      
      // Verify ownership - get the actual signer address to compare
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const owner = await crowd.owner();
      
      console.log("Transfer to Distribute - Ownership check:", {
        account: account.toLowerCase(),
        signerAddress: signerAddress.toLowerCase(),
        contractOwner: owner.toLowerCase()
      });
      
      if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
        alert(`❌ Only the campaign owner can transfer to distribution.\n\nYou are not the owner of this campaign.\n\nYour address: ${signerAddress}\nCampaign owner: ${owner}`);
        return;
      }
      
      // Check campaign state - must be "finantat" (after sponsorship request, regardless of whether sponsorship succeeded)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "finantat") {
        if (stateStr === "nefinantat") {
          alert(`❌ Cannot transfer to distribution. Campaign goal has not been reached yet.\n\nCurrent state: "${stateStr}"\n\nPlease wait until the funding goal is reached, then request sponsorship.`);
        } else if (stateStr === "prefinantat") {
          alert(`❌ Cannot transfer to distribution. Sponsorship must be requested first.\n\nCurrent state: "${stateStr}"\n\nPlease request sponsorship first, then you can transfer to distribution.`);
        } else {
          alert(`❌ Cannot transfer to distribution. Campaign state must be "finantat" (after sponsorship), but it is currently "${stateStr}".\n\nPlease request sponsorship first.`);
        }
        return;
      }
      
      // Check if already transferred
      const transferred: boolean = await crowd.transferredToDistribute();
      if (transferred) {
        alert("❌ Funds have already been transferred to DistributeFunding.\n\nThis operation can only be performed once per campaign.");
        return;
      }
      
      // Check if distributeFunding address is set in the campaign
      const campaignDistributeAddress: string = await crowd.distributeFunding();
      if (!campaignDistributeAddress || campaignDistributeAddress === ethers.ZeroAddress) {
        alert("❌ DistributeFunding address is not set in the campaign contract.\n\nThe campaign owner must set the DistributeFunding address first.");
        return;
      }
      
      // Validate DistributeFunding contract exists
      if (!ADDRESSES.distribute || !ethers.isAddress(ADDRESSES.distribute)) {
        throw new Error("DistributeFunding address is not configured. Please redeploy contracts.");
      }
      
      const distCode = await provider.getCode(ADDRESSES.distribute);
      if (distCode === "0x") {
        throw new Error("DistributeFunding contract does not exist. Please redeploy contracts.");
      }
      
      // Check if DistributeFunding has beneficiaries (required for notifyFundsReceived)
      const dist = new ethers.Contract(ADDRESSES.distribute, distributeAbi, provider);
      const beneficiariesCount = await dist.beneficiariesCount();
      if (beneficiariesCount === 0n) {
        alert("❌ Cannot transfer to distribution. No beneficiaries have been added to DistributeFunding.\n\nPlease add at least one beneficiary before transferring funds.");
        return;
      }
      
      // Check if this campaign is set in DistributeFunding (required for notifyFundsReceived)
      const distCrowdFunding = await dist.crowdFunding();
      if (distCrowdFunding.toLowerCase() !== campaignAddress.toLowerCase() && distCrowdFunding !== ethers.ZeroAddress) {
        // Need to set this campaign in DistributeFunding
        const signer = await provider.getSigner();
        const distWithSigner = new ethers.Contract(ADDRESSES.distribute, distributeAbi, signer);
        try {
          const setTx = await distWithSigner.setCrowdFunding(campaignAddress);
          await setTx.wait();
          console.log(`Set DistributeFunding.crowdFunding to ${campaignAddress}`);
        } catch (setErr) {
          console.error("Failed to set crowdFunding:", setErr);
          alert(`❌ Cannot set campaign in DistributeFunding. You may need to set it manually.\n\nError: ${setErr instanceof Error ? setErr.message : String(setErr)}`);
          return;
        }
      }
      
      // Check if campaign has tokens to transfer
      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, provider);
      const campaignTokenBalance = await token.balanceOf(campaignAddress);
      const totalCollected = await crowd.totalCollected();
      
      if (campaignTokenBalance < totalCollected) {
        alert(`❌ Campaign does not have enough tokens to transfer.\n\nCampaign balance: ${ethers.formatUnits(campaignTokenBalance, tokenDecimals)} ${tokenSymbol}\nRequired: ${ethers.formatUnits(totalCollected, tokenDecimals)} ${tokenSymbol}`);
        return;
      }

      // Use the signer we already have from ownership check
      const crowdWithSigner = new ethers.Contract(campaignAddress, crowdAbi, signer);

      const tx = await crowdWithSigner.transferToDistribute();
      await tx.wait();

      await refreshAll(undefined, campaignAddress);
      alert("✅ Funds transferred to distribution successfully!");
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = getErrorMessage(err);
      
      // User-friendly error messages
      if (errorMsg.includes("user rejected") || errorMsg.includes("denied")) {
        alert("Transaction was cancelled by user.");
      } else if (errorMsg.includes("missing revert data") || errorMsg.includes("CALL_EXCEPTION") || errorMsg.includes("0x118cdaa7") || errorMsg.includes("OwnableUnauthorizedAccount")) {
        // Check if it's an ownership error
        if (errorMsg.includes("0x118cdaa7") || errorMsg.includes("OwnableUnauthorizedAccount")) {
          alert(`❌ Ownership error. You are not the owner of this campaign.\n\nPlease verify:\n- You are connected with the correct wallet\n- You are the owner of campaign: ${campaignAddress}\n\nTry refreshing the page and reconnecting your wallet.`);
        } else {
          alert(`❌ Cannot estimate gas for transfer. Possible causes:\n\n1. You are not the owner of the campaign\n2. DistributeFunding address is not set in the campaign\n3. No beneficiaries have been added to DistributeFunding\n4. Campaign does not have enough tokens\n5. Funds have already been transferred\n\nPlease check:\n- Campaign address: ${campaignAddress}\n- DistributeFunding address: ${ADDRESSES.distribute}\n- Add beneficiaries before transferring\n- Verify you are the campaign owner`);
        }
      } else if (errorMsg.includes("revert") || errorMsg.includes("execution reverted")) {
        if (errorMsg.includes("not funded")) {
          alert("❌ Campaign state is not 'finantat'. Please request sponsorship first.");
        } else if (errorMsg.includes("already transferred")) {
          alert("❌ Funds have already been transferred to DistributeFunding.");
        } else if (errorMsg.includes("dist=0")) {
          alert("❌ DistributeFunding address is not set in the campaign contract.");
        } else if (errorMsg.includes("no beneficiaries")) {
          alert("❌ No beneficiaries have been added to DistributeFunding. Please add at least one beneficiary first.");
        } else if (errorMsg.includes("transfer failed")) {
          alert("❌ Token transfer failed. The campaign may not have enough tokens.");
        } else {
          alert(`❌ Transaction failed. The contract rejected the operation.\n\nError: ${errorMsg}\n\nPlease check:\n- Campaign state must be 'finantat'\n- DistributeFunding has beneficiaries\n- Campaign has tokens to transfer\n- You are the owner of the campaign`);
        }
      } else if (errorMsg.includes("Only the campaign owner")) {
        // Already handled above
      } else {
        alert(`❌ Error transferring to distribution: ${errorMsg}`);
      }
    } finally {
      setTransferringDist(false);
    }
  }

  async function addBeneficiary() {
    // Use viewingCampaign if available, otherwise selectedCampaign
    const campaignAddress = viewingCampaign || selectedCampaign;
    
    if (!campaignAddress) {
      alert("Please select or view a campaign first");
      return;
    }
    
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }

    // Verify ownership
    try {
      const provider = await getProvider();
      const crowd = new ethers.Contract(campaignAddress, crowdAbi, provider);
      const owner = await crowd.owner();
      
      if (account.toLowerCase() !== owner.toLowerCase()) {
        alert("❌ Only the campaign owner can add beneficiaries.\n\nYou are not the owner of this campaign.");
        return;
      }
    } catch (err) {
      alert("❌ Could not verify campaign ownership. Please try again.");
      return;
    }

    if (!ethers.isAddress(benAddress)) {
      alert("❌ Invalid beneficiary address. Please enter a valid Ethereum address.");
      return;
    }

    const w = Number(benWeight);
    if (!benWeight || Number.isNaN(w) || w <= 0 || w > 10000) {
      alert("❌ Invalid weight. Please enter a number between 1 and 10000.\n\nExample: 6000 = 60%");
      return;
    }

    try {
      setAddingBen(true);

      const provider = await getProvider();
      
      // Validate DistributeFunding contract exists
      if (!ADDRESSES.distribute || !ethers.isAddress(ADDRESSES.distribute)) {
        throw new Error("DistributeFunding address is not configured. Please redeploy contracts.");
      }
      
      const distCode = await provider.getCode(ADDRESSES.distribute);
      if (distCode === "0x") {
        throw new Error("DistributeFunding contract does not exist. Please redeploy contracts.");
      }

      const signer = await provider.getSigner();
      const dist = new ethers.Contract(ADDRESSES.distribute, distributeAbi, signer);

      const tx = await dist.addBeneficiary(benAddress, w);
      await tx.wait();

      await refreshAll(undefined, campaignAddress);
      setBenAddress("");
      setBenWeight("");
      alert(`✅ Beneficiary added successfully!\n\nAddress: ${benAddress}\nWeight: ${w} (${(w / 100).toFixed(2)}%)`);
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = getErrorMessage(err);
      
      // User-friendly error messages
      if (errorMsg.includes("user rejected") || errorMsg.includes("denied")) {
        alert("Transaction was cancelled by user.");
      } else if (errorMsg.includes("revert") || errorMsg.includes("execution reverted")) {
        if (errorMsg.includes("total weight") || errorMsg.includes("exceeds")) {
          alert("❌ Transaction failed. The total weight of all beneficiaries would exceed 100% (10000 basis points).\n\nPlease reduce the weight or remove existing beneficiaries first.");
        } else if (errorMsg.includes("already exists") || errorMsg.includes("duplicate")) {
          alert("❌ This beneficiary address is already added to the distribution list.");
        } else {
          alert("❌ Transaction failed. The contract rejected the operation. Please check the beneficiary address and weight.");
        }
      } else {
        alert(`❌ Error adding beneficiary: ${errorMsg}`);
      }
    } finally {
      setAddingBen(false);
    }
  }

  function friendlyEthersError(err: unknown): string {
    const getStr = (v: unknown): string | undefined =>
      typeof v === "string" ? v : undefined;

    const getProp = (obj: unknown, key: string): unknown => {
      if (obj && typeof obj === "object" && key in obj) {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    };

    const shortMessage = getStr(getProp(err, "shortMessage"));
    const reason = getStr(getProp(err, "reason"));
    const message = err instanceof Error ? err.message : getStr(getProp(err, "message"));

    const base = shortMessage || reason || message || "Tranzactie esuata";

    const m = base.match(/reverted with reason string '([^']+)'/i);
    if (m?.[1]) return m[1];

    if (base.includes("missing revert data")) {
      return "Tranzactie respinsa de contract (deja ai facut claim / nu esti beneficiar / nu e pregatit).";
    }

    return base;
  }


  async function claim() {
    try {
      const provider = await getProvider();
      const signer = await provider.getSigner();

      const distRead = new ethers.Contract(ADDRESSES.distribute, distributeAbi, provider);
      const dist = new ethers.Contract(ADDRESSES.distribute, distributeAbi, signer);

      // 1) pre-check: fonduri primite?
      const notified: boolean = await distRead.fundingNotified();
      if (!notified) {
        alert("❌ Cannot claim funds. Funds have not been transferred to DistributeFunding yet.\n\nThe campaign owner must first transfer funds from the campaign to DistributeFunding.");
        return;
      }

      // 2) pre-check: esti beneficiar + n-ai claim-uit deja
      const b = await distRead.beneficiaries(account);
      // b = [weightBps, exists, claimed] (ethers iti da si index si nume)
      const exists: boolean = b.exists ?? b[1];
      const claimed: boolean = b.claimed ?? b[2];

      if (!exists) {
        alert("❌ Cannot claim funds. This address is not registered as a beneficiary.\n\nOnly addresses added as beneficiaries by the campaign owner can claim funds.");
        return;
      }
      if (claimed) {
        alert("❌ Cannot claim funds. You have already claimed your share.\n\nEach beneficiary can only claim once.");
        return;
      }

      // 3) call real
      const tx = await dist.claim();
      const receipt = await tx.wait();
      
      // Calculate the amount claimed
      const totalReceived = await distRead.totalReceived();
      const weightBps = b.weightBps ?? b[0];
      const amountClaimed = (totalReceived * BigInt(weightBps)) / BigInt(10000);
      
      alert(`✅ Claim successful!\n\nYou received ${ethers.formatUnits(amountClaimed, tokenDecimals)} ${tokenSymbol}\n\nTransaction: ${receipt?.hash}`);
      await refreshAll();
    } catch (err: unknown) {
      console.error(err);
      alert(friendlyEthersError(err));
    }
  }



  if (currentPage === "token" && account) {
    return (
      <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1000 }}>
        <div style={{ marginBottom: "2rem" }}>
          <button
            onClick={() => setCurrentPage("main")}
            style={{ marginRight: "1rem", padding: "8px 16px" }}
          >
            ← Back to Main
          </button>
        </div>
        <TokenPage
          account={account}
          tokenSymbol={tokenSymbol}
          tokenDecimals={tokenDecimals}
          tokenBalance={tokenBalance}
          pricePerToken={pricePerToken}
          onRefresh={refreshAll}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1000 }}>
      <h1>Blockchain Crowdfunding DApp</h1>

      {!account ? (
        <button onClick={connectWallet} disabled={connecting}>
          {connecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <>
          <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
            <button
              onClick={() => setCurrentPage("token")}
              style={{ padding: "8px 16px" }}
            >
              Token Operations
            </button>
          </div>

          <p><b>Account:</b> {account}</p>
          <p><b>ETH Balance:</b> {ethBalance}</p>

          <button onClick={() => refreshAll()} disabled={loading} style={{ marginBottom: 16 }}>
            {loading ? "Refreshing..." : "Refresh All"}
          </button>

          <hr style={{ margin: "24px 0" }} />

          <h2>Campaign Management</h2>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              <b>Select Campaign:</b>
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              style={{ padding: "8px", minWidth: "400px", marginBottom: "1rem" }}
            >
              {campaigns.length === 0 ? (
                <option value="">No campaigns available</option>
              ) : (
                campaigns.map((campaign) => (
                  <option key={campaign.address} value={campaign.address}>
                    {campaign.name || campaign.address} ({campaign.address.slice(0, 10)}...)
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #555", borderRadius: "4px", backgroundColor: "#2d2d2d", color: "#ffffff" }}>
            <h3 style={{ marginTop: 0, color: "#ffffff" }}>1. Add Existing Campaign</h3>
            <p style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "1rem" }}>
              Use this to add an <b>already created</b> campaign to your list. You will <b>NOT</b> be the owner unless you created it.
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
              <input
                value={newCampaignAddress}
                onChange={(e) => setNewCampaignAddress(e.target.value)}
                placeholder="Campaign contract address (0x...)"
                style={{ 
                  padding: 8, 
                  width: "400px", 
                  backgroundColor: "#1a1a1a",
                  color: "#ffffff",
                  border: "1px solid #555",
                  borderRadius: "4px"
                }}
              />
              <button
                onClick={async () => {
                  try {
                    await addCampaign(newCampaignAddress);
                  } catch (err) {
                    console.error("Error adding campaign:", err);
                    alert(`Failed to add campaign: ${err instanceof Error ? err.message : "Unknown error"}`);
                  }
                }}
                disabled={!newCampaignAddress}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#1976d2",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: !newCampaignAddress ? "not-allowed" : "pointer",
                }}
              >
                Add Campaign
              </button>
            </div>
            <p style={{ fontSize: "0.85em", color: "#888", fontStyle: "italic" }}>
              Example: Paste a campaign address like <code style={{ backgroundColor: "#1a1a1a", padding: "2px 4px" }}>0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9</code>
            </p>
          </div>

          <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #4caf50", borderRadius: "4px", backgroundColor: "#1b5e20", color: "#ffffff" }}>
            <h3 style={{ marginTop: 0, color: "#ffffff" }}>2. Create New Campaign (You Become Owner!)</h3>
            <p style={{ fontSize: "0.9em", color: "#c8e6c9", marginBottom: "1rem" }}>
              Use this to create a <b>brand new</b> campaign. You will be the <b>owner</b> and can manage it.
            </p>
            
            <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#2d2d2d", borderRadius: "4px" }}>
              <p style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.5rem", marginTop: 0 }}>
                <b>Step 1:</b> Get Factory Address
              </p>
              <p style={{ fontSize: "0.85em", color: "#888", marginBottom: "0.5rem" }}>
                Run: <code style={{ backgroundColor: "#1a1a1a", padding: "2px 6px", borderRadius: "3px", color: "#4caf50" }}>npx hardhat run scripts/deploy.ts --network localhost</code>
              </p>
              <p style={{ fontSize: "0.85em", color: "#888", marginTop: "0.5rem", marginBottom: 0 }}>
                Copy the <b>CampaignFactory</b> address from the output
              </p>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9em", color: "#c8e6c9" }}>
                <b>Factory Contract Address:</b>
              </label>
              <input
                value={factoryAddress}
                onChange={(e) => setFactoryAddress(e.target.value)}
                placeholder="Paste Factory address here (0x...)"
                style={{ 
                  padding: 8, 
                  width: "100%",
                  maxWidth: "500px",
                  backgroundColor: "#1a1a1a",
                  color: "#ffffff",
                  border: "1px solid #555",
                  borderRadius: "4px"
                }}
              />
              {ADDRESSES.factory && (
                <p style={{ fontSize: "0.8em", color: "#888", marginTop: "0.25rem", marginBottom: 0 }}>
                  💡 Pre-configured factory: <code style={{ backgroundColor: "#1a1a1a", padding: "2px 4px" }}>{ADDRESSES.factory}</code>
                  {!factoryAddress && (
                    <button
                      onClick={() => setFactoryAddress(ADDRESSES.factory)}
                      style={{
                        marginLeft: "0.5rem",
                        padding: "2px 8px",
                        fontSize: "0.8em",
                        backgroundColor: "#4caf50",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Use This
                    </button>
                  )}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9em", color: "#c8e6c9" }}>
                <b>Funding Goal (in tokens):</b>
              </label>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={newCampaignGoal}
                  onChange={(e) => setNewCampaignGoal(e.target.value)}
                  placeholder="e.g. 1000 (means 1000 tokens)"
                  type="number"
                  style={{ 
                    padding: 8, 
                    width: "200px",
                    backgroundColor: "#1a1a1a",
                    color: "#ffffff",
                    border: "1px solid #555",
                    borderRadius: "4px"
                  }}
                />
                <button
                  onClick={createCampaignViaFactory}
                  disabled={!factoryAddress || !newCampaignGoal || creatingCampaign}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: creatingCampaign ? "#555" : "#4caf50",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: (!factoryAddress || !newCampaignGoal || creatingCampaign) ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {creatingCampaign ? "Creating..." : "✨ Create Campaign"}
                </button>
              </div>
              <p style={{ fontSize: "0.85em", color: "#888", marginTop: "0.5rem", marginBottom: 0 }}>
                Example: Enter <code style={{ backgroundColor: "#1a1a1a", padding: "2px 4px" }}>2000</code> for a goal of 2000 tokens
              </p>
            </div>

            <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#2d2d2d", borderRadius: "4px", border: "1px solid #4caf50" }}>
              <p style={{ fontSize: "0.85em", color: "#c8e6c9", margin: 0 }}>
                ✅ After creation, you will automatically become the owner<br/>
                ✅ You can remove the campaign from your list<br/>
                ✅ You can perform all owner actions (sponsorship, distribution, etc.)
              </p>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h3>Campaigns List</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {campaigns.map((campaign) => (
                  <li
                    key={campaign.address}
                    style={{
                      padding: "0.75rem",
                      marginBottom: "0.75rem",
                      backgroundColor: viewingCampaign.toLowerCase() === campaign.address.toLowerCase() ? "#0d47a1" : "#1a1a1a",
                      color: "#ffffff",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                        {campaign.name || "Unnamed Campaign"}
                      </div>
                      <div style={{ fontSize: "0.85em", opacity: 0.9 }}>
                        {campaign.address.slice(0, 10)}...{campaign.address.slice(-8)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => viewCampaign(campaign.address)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.9em",
                          backgroundColor: viewingCampaign.toLowerCase() === campaign.address.toLowerCase() ? "#0d47a1" : "#1976d2",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {viewingCampaign.toLowerCase() === campaign.address.toLowerCase() ? "Viewing" : "View Campaign"}
                      </button>
                      {(() => {
                        const normalized = campaign.address.toLowerCase();
                        const campaignOwner = campaignOwners[normalized];
                        const ownerLoaded = !!campaignOwner; // Check if owner has been loaded
                        const isCampaignOwner = account && campaignOwner && account.toLowerCase() === campaignOwner;
                        const canRemove = ownerLoaded && isCampaignOwner; // Only allow if owner is loaded AND user is owner
                        
                        return (
                          <button
                            onClick={() => removeCampaign(campaign.address)}
                            disabled={!canRemove}
                            style={{
                              padding: "6px 12px",
                              fontSize: "0.9em",
                              backgroundColor: canRemove ? "#d32f2f" : "#555",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: canRemove ? "pointer" : "not-allowed",
                              opacity: canRemove ? 1 : 0.5,
                            }}
                            title={
                              !ownerLoaded 
                                ? "Loading owner information..." 
                                : !isCampaignOwner 
                                  ? "Only the campaign owner can remove this campaign" 
                                  : "Remove campaign from list"
                            }
                          >
                            Remove
                          </button>
                        );
                      })()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {viewingCampaign && (
            <>
              <hr style={{ margin: "24px 0" }} />
              <div
                style={{
                  backgroundColor: "#1e1e1e",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "2px solid #1565c0",
                  marginBottom: "1.5rem",
                  color: "#ffffff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 style={{ margin: 0, color: "#ffffff" }}>Campaign Details</h2>
                  <button
                    onClick={closeCampaignView}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#616161",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ backgroundColor: "#2d2d2d", padding: "1rem", borderRadius: "6px", border: "1px solid #404040" }}>
                    <div style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.25rem" }}>Campaign Address</div>
                    <div style={{ fontWeight: "bold", wordBreak: "break-all", color: "#ffffff" }}>{viewingCampaign}</div>
                  </div>
                  <div style={{ backgroundColor: "#2d2d2d", padding: "1rem", borderRadius: "6px", border: "1px solid #404040" }}>
                    <div style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.25rem" }}>State</div>
                    <div style={{ fontWeight: "bold", color: cfState === "nefinantat" ? "#ff9800" : cfState === "prefinantat" ? "#42a5f5" : "#66bb6a" }}>
                      {cfState}
                    </div>
                  </div>
                  <div style={{ backgroundColor: "#2d2d2d", padding: "1rem", borderRadius: "6px", border: "1px solid #404040" }}>
                    <div style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.25rem" }}>Funding Goal</div>
                    <div style={{ fontWeight: "bold", color: "#ffffff" }}>{cfGoal} {tokenSymbol}</div>
                  </div>
                  <div style={{ backgroundColor: "#2d2d2d", padding: "1rem", borderRadius: "6px", border: "1px solid #404040" }}>
                    <div style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.25rem" }}>Total Collected</div>
                    <div style={{ fontWeight: "bold", color: "#ffffff" }}>{cfTotal} {tokenSymbol}</div>
                  </div>
                  <div style={{ backgroundColor: "#2d2d2d", padding: "1rem", borderRadius: "6px", border: "1px solid #404040" }}>
                    <div style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.25rem" }}>My Contribution</div>
                    <div style={{ fontWeight: "bold", color: "#ffffff" }}>{myContribution} {tokenSymbol}</div>
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", backgroundColor: "#2d2d2d", padding: "1.5rem", borderRadius: "8px" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#ffffff" }}>Campaign Actions</h3>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#ffffff" }}>
                      1) Approve tokens for this campaign
                    </label>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <input
                        value={approveAmount}
                        onChange={(e) => setApproveAmount(e.target.value)}
                        placeholder="Approve amount (e.g. 100)"
                        style={{ 
                          padding: 8, 
                          width: 260, 
                          borderRadius: "4px", 
                          border: "1px solid #555", 
                          backgroundColor: "#1a1a1a",
                          color: "#ffffff"
                        }}
                      />
                      <button
                        onClick={approveCrowd}
                        disabled={approving || !viewingCampaign}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#1976d2",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: approving ? "not-allowed" : "pointer",
                        }}
                      >
                        {approving ? "Approving..." : "Approve"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#ffffff" }}>
                      2) Contribute to this campaign
                    </label>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <input
                        value={contributeAmount}
                        onChange={(e) => setContributeAmount(e.target.value)}
                        placeholder="Contribute amount (e.g. 50)"
                        style={{ 
                          padding: 8, 
                          width: 260, 
                          borderRadius: "4px", 
                          border: "1px solid #555", 
                          backgroundColor: "#1a1a1a",
                          color: "#ffffff"
                        }}
                      />
                      <button
                        onClick={contribute}
                        disabled={contributing || !viewingCampaign || cfState !== "nefinantat"}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: cfState === "nefinantat" ? "#388e3c" : "#666",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: (contributing || !viewingCampaign || cfState !== "nefinantat") ? "not-allowed" : "pointer",
                        }}
                        title={cfState !== "nefinantat" ? `Contribute is only allowed when campaign state is "nefinantat". Current state: ${cfState}` : ""}
                      >
                        {contributing ? "Contributing..." : "Contribute"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#ffffff" }}>
                      3) Withdraw from this campaign (only if NEFINANTAT)
                    </label>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <input
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Withdraw amount (e.g. 10)"
                        style={{ 
                          padding: 8, 
                          width: 260, 
                          borderRadius: "4px", 
                          border: "1px solid #555", 
                          backgroundColor: "#1a1a1a",
                          color: "#ffffff"
                        }}
                      />
                      <button
                        onClick={withdraw}
                        disabled={withdrawing || !viewingCampaign || cfState !== "nefinantat"}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: cfState === "nefinantat" ? "#f57c00" : "#666",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: (withdrawing || !viewingCampaign || cfState !== "nefinantat") ? "not-allowed" : "pointer",
                        }}
                        title={cfState !== "nefinantat" ? `Withdraw is only allowed when campaign state is "nefinantat". Current state: ${cfState}` : ""}
                      >
                        {withdrawing ? "Withdrawing..." : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ margin: "24px 0" }} />
              <div
                style={{
                  backgroundColor: "#2d2d2d",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "1px solid #ff9800",
                  color: "#ffffff",
                }}
              >
              <h2 style={{ marginTop: 0, color: "#ffffff" }}>Owner Actions</h2>
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "#ffffff" }}><b>Crowd owner:</b> {cfOwner}</p>
                <p style={{ color: "#ffffff" }}><b>You are owner:</b> {isOwner ? "✅ YES" : "❌ NO"}</p>
              </div>

              <div style={{ opacity: isOwner ? 1 : 0.5 }}>
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "0.5rem", color: "#ffffff" }}>0) Add Beneficiary (DistributeFunding)</h3>
                  <p style={{ marginBottom: "0.75rem", fontSize: "0.9em", color: "#b0b0b0" }}>
                    <b style={{ color: "#ffffff" }}>Beneficiaries:</b> {benCount}{" "}
                    {totalWeightBps !== "N/A" && (
                      <>
                        | <b style={{ color: "#ffffff" }}>Total weight (bps):</b> {totalWeightBps} / 10000
                      </>
                    )}
                  </p>

                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      value={benAddress}
                      onChange={(e) => setBenAddress(e.target.value)}
                      placeholder="Beneficiary address (0x...)"
                      style={{ 
                        padding: 8, 
                        width: 420, 
                        borderRadius: "4px", 
                        border: "1px solid #555", 
                        backgroundColor: "#1a1a1a",
                        color: "#ffffff"
                      }}
                      disabled={!isOwner}
                    />
                    <input
                      value={benWeight}
                      onChange={(e) => setBenWeight(e.target.value)}
                      placeholder="weightBps (ex 6000 = 60%)"
                      style={{ 
                        padding: 8, 
                        width: 220, 
                        borderRadius: "4px", 
                        border: "1px solid #555", 
                        backgroundColor: "#1a1a1a",
                        color: "#ffffff"
                      }}
                      disabled={!isOwner}
                    />
                    <button
                      onClick={addBeneficiary}
                      disabled={!isOwner || addingBen}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#7b1fa2",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: (!isOwner || addingBen) ? "not-allowed" : "pointer",
                      }}
                    >
                      {addingBen ? "Adding..." : "Add Beneficiary"}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "0.5rem", color: "#ffffff" }}>1) Buy Sponsor Tokens</h3>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      value={sponsorBuyAmount}
                      onChange={(e) => setSponsorBuyAmount(e.target.value)}
                      placeholder="Sponsor buy amount (e.g. 200)"
                      style={{ 
                        padding: 8, 
                        width: 260, 
                        borderRadius: "4px", 
                        border: "1px solid #555", 
                        backgroundColor: "#1a1a1a",
                        color: "#ffffff"
                      }}
                      disabled={!isOwner}
                    />
                    <button
                      onClick={buySponsorTokens}
                      disabled={!isOwner || buyingSponsor}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#0288d1",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: (!isOwner || buyingSponsor) ? "not-allowed" : "pointer",
                      }}
                    >
                      {buyingSponsor ? "Buying..." : "Buy for SponsorFunding"}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "0.5rem", color: "#ffffff" }}>2) Request Sponsorship</h3>
                  <button
                    onClick={requestSponsorship}
                    disabled={!isOwner || requestingSponsor}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#5c6bc0",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: (!isOwner || requestingSponsor) ? "not-allowed" : "pointer",
                    }}
                  >
                    {requestingSponsor ? "Requesting..." : "Request Sponsorship"}
                  </button>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "0.5rem", color: "#ffffff" }}>3) Transfer To Distribute</h3>
                  <button
                    onClick={transferToDistribute}
                    disabled={!isOwner || transferringDist || !viewingCampaign}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#c62828",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: (!isOwner || transferringDist || !viewingCampaign) ? "not-allowed" : "pointer",
                    }}
                  >
                    {transferringDist ? "Transferring..." : "Transfer To Distribute"}
                  </button>
                </div>
              </div>
            </div>

            <hr style={{ margin: "24px 0" }} />
              <div
                style={{
                  backgroundColor: "#1b5e20",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "1px solid #4caf50",
                  color: "#ffffff",
                }}
              >
                <h2 style={{ marginTop: 0, color: "#ffffff" }}>Beneficiary Actions</h2>
                <button
                  onClick={claim}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#4caf50",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "1em",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Claim Funds
                </button>
                <p style={{ marginTop: "0.5rem", color: "#c8e6c9", fontSize: "0.9em" }}>
                  (Only beneficiaries can claim, and only once)
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
