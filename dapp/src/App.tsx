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

  // Load campaigns from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Campaign[];
        setCampaigns(parsed);
        // If there's a default campaign in ADDRESSES, add it if not present
        if (ADDRESSES.crowd && !parsed.find(c => c.address.toLowerCase() === ADDRESSES.crowd.toLowerCase())) {
          const defaultCampaigns = [{ address: ADDRESSES.crowd, name: "Default Campaign" }, ...parsed];
          setCampaigns(defaultCampaigns);
          setSelectedCampaign(ADDRESSES.crowd);
          localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(defaultCampaigns));
        } else if (parsed.length > 0 && !selectedCampaign) {
          setSelectedCampaign(parsed[0].address);
        }
      } catch (e) {
        console.error("Failed to load campaigns from storage", e);
      }
    } else {
      // Initialize with default campaign if available
      if (ADDRESSES.crowd) {
        const defaultCampaigns = [{ address: ADDRESSES.crowd, name: "Default Campaign" }];
        setCampaigns(defaultCampaigns);
        setSelectedCampaign(ADDRESSES.crowd);
        localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(defaultCampaigns));
      }
    }
  }, []);

  // Save campaigns to localStorage whenever they change
  useEffect(() => {
    if (campaigns.length > 0) {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
    }
  }, [campaigns]);

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return "Unknown error";
  }

  async function getProvider() {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    return new ethers.BrowserProvider(window.ethereum);
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
    setNewCampaignAddress("");
  }

  function viewCampaign(address: string) {
    setViewingCampaign(address);
    setSelectedCampaign(address); // Also set as selected for operations
    refreshAll(account, address);
  }

  function closeCampaignView() {
    setViewingCampaign("");
    // Keep selectedCampaign for operations, but clear viewing state
  }

  function removeCampaign(address: string) {
    const newCampaigns = campaigns.filter(c => c.address.toLowerCase() !== address.toLowerCase());
    setCampaigns(newCampaigns);
    if (selectedCampaign.toLowerCase() === address.toLowerCase()) {
      setSelectedCampaign(newCampaigns.length > 0 ? newCampaigns[0].address : "");
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

      if (event) {
        const parsed = factory.interface.parseLog(event);
        const campaignAddress = parsed?.args[0];
        if (campaignAddress) {
          addCampaign(campaignAddress, `Campaign ${campaigns.length + 1}`);
          setNewCampaignGoal("");
          alert(`Campaign created: ${campaignAddress}`);
        }
      } else {
        // Fallback: query the factory for the latest campaign
        const allCampaigns = await factory.getAllCampaigns();
        if (allCampaigns.length > 0) {
          const newAddress = allCampaigns[allCampaigns.length - 1];
          addCampaign(newAddress, `Campaign ${campaigns.length + 1}`);
          setNewCampaignGoal("");
          alert(`Campaign created: ${newAddress}`);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setCreatingCampaign(false);
    }
  }



  async function approveCrowd() {
    if (!selectedCampaign) {
      alert("Please select a campaign first");
      return;
    }
    if (!approveAmount || Number(approveAmount) <= 0) {
      alert("Introdu o suma valida pentru approve");
      return;
    }

    try {
      setApproving(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);

      const amountUnits = ethers.parseUnits(approveAmount, tokenDecimals);
      const tx = await token.approve(selectedCampaign, amountUnits);
      await tx.wait();

      await refreshAll();
      setApproveAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  async function contribute() {
    if (!selectedCampaign) {
      alert("Please select a campaign first");
      return;
    }
    if (!contributeAmount || Number(contributeAmount) <= 0) {
      alert("Introdu o suma valida pentru contribute");
      return;
    }

    try {
      setContributing(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
      const crowd = new ethers.Contract(selectedCampaign, crowdAbi, signer);

      // 1) verifica starea inainte (mesaj corect pentru profesor)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "nefinantat") {
        alert(`Nu mai poti contribui: campania este ${stateStr}.`);
        return;
      }

      // 2) allowance dupa (doar daca e permis sa contribui)
      const amountUnits = ethers.parseUnits(contributeAmount, tokenDecimals);
      const allowance: bigint = await token.allowance(account, selectedCampaign);

      if (allowance < amountUnits) {
        alert("Allowance insuficient. Fa approve inainte (sau mareste approve).");
        return;
      }

      const tx = await crowd.contribute(amountUnits);
      await tx.wait();

      await refreshAll();
      setContributeAmount("");
    } catch (err: unknown) {
      console.error(err);

      // incearca sa afiseze un mesaj mai prietenos
      const msg =
        err instanceof Error ? err.message : "Eroare necunoscuta la contribute";
      alert(msg);
    } finally {
      setContributing(false);
    }
  }

  async function withdraw() {
    if (!selectedCampaign) {
      alert("Please select a campaign first");
      return;
    }
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      alert("Introdu o suma valida pentru withdraw");
      return;
    }

    try {
      setWithdrawing(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(selectedCampaign, crowdAbi, signer);

      // verifica starea inainte (altfel MetaMask arata erori urate)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "nefinantat") {
        alert(`Nu poti face withdraw: campania este ${stateStr}.`);
        return;
      }

      const amountUnits = ethers.parseUnits(withdrawAmount, tokenDecimals);
      const tx = await crowd.withdraw(amountUnits);
      await tx.wait();

      await refreshAll();
      setWithdrawAmount("");
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Eroare necunoscuta la withdraw";
      alert(msg);
    } finally {
      setWithdrawing(false);
    }
  }

  async function buySponsorTokens() {
    if (!isOwner) {
      alert("Doar owner poate cumpara tokeni pentru sponsor");
      return;
    }
    if (!sponsorBuyAmount || Number(sponsorBuyAmount) <= 0) {
      alert("Introdu o suma valida pentru sponsor buy");
      return;
    }

    try {
      setBuyingSponsor(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
      const sponsor = new ethers.Contract(ADDRESSES.sponsor, sponsorAbi, signer);

      const amountUnits = ethers.parseUnits(sponsorBuyAmount, tokenDecimals);

      const ppu: bigint = await token.pricePerUnitWei();
      const costWei = amountUnits * ppu;

      const tx = await sponsor.buySponsorTokens(amountUnits, { value: costWei });
      await tx.wait();

      await refreshAll();
      setSponsorBuyAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setBuyingSponsor(false);
    }
  }

  async function requestSponsorship() {
    if (!selectedCampaign) {
      alert("Please select a campaign first");
      return;
    }
    if (!isOwner) {
      alert("Doar owner poate cere sponsorizare");
      return;
    }

    try {
      setRequestingSponsor(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(selectedCampaign, crowdAbi, signer);

      const tx = await crowd.requestSponsorship();
      await tx.wait();

      await refreshAll();
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setRequestingSponsor(false);
    }
  }

  async function transferToDistribute() {
    if (!selectedCampaign) {
      alert("Please select a campaign first");
      return;
    }
    if (!isOwner) {
      alert("Doar owner poate transfera catre distributie");
      return;
    }

    try {
      setTransferringDist(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(selectedCampaign, crowdAbi, signer);

      const tx = await crowd.transferToDistribute();
      await tx.wait();

      await refreshAll();
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setTransferringDist(false);
    }
  }

  async function addBeneficiary() {
    if (!isOwner) {
      alert("Doar owner poate adauga beneficiari");
      return;
    }

    if (!ethers.isAddress(benAddress)) {
      alert("Adresa beneficiar invalida");
      return;
    }

    const w = Number(benWeight);
    if (!benWeight || Number.isNaN(w) || w <= 0 || w > 10000) {
      alert("weightBps invalid (1..10000). Ex: 6000 = 60%");
      return;
    }

    try {
      setAddingBen(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const dist = new ethers.Contract(ADDRESSES.distribute, distributeAbi, signer);

      const tx = await dist.addBeneficiary(benAddress, w);
      await tx.wait();

      await refreshAll();
      setBenAddress("");
      setBenWeight("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
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
        alert("Nu poti face claim: inca nu s-au transferat fondurile in DistributeFunding.");
        return;
      }

      // 2) pre-check: esti beneficiar + n-ai claim-uit deja
      const b = await distRead.beneficiaries(account);
      // b = [weightBps, exists, claimed] (ethers iti da si index si nume)
      const exists: boolean = b.exists ?? b[1];
      const claimed: boolean = b.claimed ?? b[2];

      if (!exists) {
        alert("Nu poti face claim: acest cont nu este beneficiar.");
        return;
      }
      if (claimed) {
        alert("Nu poti face claim: ai facut deja claim o data.");
        return;
      }

      // 3) call real
      const tx = await dist.claim();
      await tx.wait();

      alert("Claim reusit!");
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
            <h3 style={{ marginTop: 0, color: "#ffffff" }}>Add Campaign</h3>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
              <input
                value={newCampaignAddress}
                onChange={(e) => setNewCampaignAddress(e.target.value)}
                placeholder="Campaign address (0x...)"
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
                onClick={() => addCampaign(newCampaignAddress)}
                disabled={!newCampaignAddress}
              >
                Add Campaign
              </button>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ color: "#ffffff" }}>Or Create New Campaign via Factory</h4>
              <p style={{ fontSize: "0.9em", color: "#b0b0b0", marginBottom: "0.5rem" }}>
                Adresa Factory se obține după deploy: <code style={{ backgroundColor: "#1a1a1a", padding: "2px 6px", borderRadius: "3px", color: "#4caf50" }}>npx hardhat run scripts/deploy.ts --network localhost</code>
              </p>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <input
                  value={factoryAddress}
                  onChange={(e) => setFactoryAddress(e.target.value)}
                  placeholder="Factory contract address (0x...) - vezi output deploy"
                  style={{ 
                    padding: 8, 
                    width: "400px",
                    backgroundColor: "#1a1a1a",
                    color: "#ffffff",
                    border: "1px solid #555",
                    borderRadius: "4px"
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={newCampaignGoal}
                  onChange={(e) => setNewCampaignGoal(e.target.value)}
                  placeholder="Funding goal (e.g. 1000)"
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
                >
                  {creatingCampaign ? "Creating..." : "Create Campaign"}
                </button>
              </div>
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
                      <button
                        onClick={() => removeCampaign(campaign.address)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.9em",
                          backgroundColor: "#d32f2f",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
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
                        disabled={contributing || !viewingCampaign}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#388e3c",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: contributing ? "not-allowed" : "pointer",
                        }}
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
                        disabled={withdrawing || !viewingCampaign}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#f57c00",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: withdrawing ? "not-allowed" : "pointer",
                        }}
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
