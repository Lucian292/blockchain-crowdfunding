import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "./contracts/addresses";
import { tokenAbi } from "./contracts/tokenAbi";
import { crowdAbi } from "./contracts/crowdAbi";
import { sponsorAbi } from "./contracts/sponsorAbi";
import { distributeAbi } from "./contracts/distributeAbi";
import TokenPage from "./TokenPage";

type Page = "main" | "token";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("main");
  const [account, setAccount] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("");

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

  async function refreshAll(addr?: string) {
    const user = addr ?? account;
    if (!user) return;

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

      // CrowdFunding (read-only)
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, provider);

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



  async function approveCrowd() {
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
      const tx = await token.approve(ADDRESSES.crowd, amountUnits);
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
    if (!contributeAmount || Number(contributeAmount) <= 0) {
      alert("Introdu o suma valida pentru contribute");
      return;
    }

    try {
      setContributing(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();

      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, signer);

      // 1) verifica starea inainte (mesaj corect pentru profesor)
      const stateStr: string = await crowd.getStateString();
      if (stateStr !== "nefinantat") {
        alert(`Nu mai poti contribui: campania este ${stateStr}.`);
        return;
      }

      // 2) allowance dupa (doar daca e permis sa contribui)
      const amountUnits = ethers.parseUnits(contributeAmount, tokenDecimals);
      const allowance: bigint = await token.allowance(account, ADDRESSES.crowd);

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
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      alert("Introdu o suma valida pentru withdraw");
      return;
    }

    try {
      setWithdrawing(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, signer);

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
    if (!isOwner) {
      alert("Doar owner poate cere sponsorizare");
      return;
    }

    try {
      setRequestingSponsor(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, signer);

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
    if (!isOwner) {
      alert("Doar owner poate transfera catre distributie");
      return;
    }

    try {
      setTransferringDist(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, signer);

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

          <h2>CrowdFunding</h2>
          <p><b>State:</b> {cfState}</p>
          <p><b>Goal:</b> {cfGoal} {tokenSymbol}</p>
          <p><b>Total collected:</b> {cfTotal} {tokenSymbol}</p>
          <p><b>My contribution:</b> {myContribution} {tokenSymbol}</p>

          <h3>1) Approve token pentru CrowdFunding</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              placeholder="Approve amount (e.g. 100)"
              style={{ padding: 8, width: 260 }}
            />
            <button onClick={approveCrowd} disabled={approving}>
              {approving ? "Approving..." : "Approve"}
            </button>
          </div>

          <h3 style={{ marginTop: 16 }}>2) Contribute</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              placeholder="Contribute amount (e.g. 50)"
              style={{ padding: 8, width: 260 }}
            />
            <button onClick={contribute} disabled={contributing}>
              {contributing ? "Contributing..." : "Contribute"}
            </button>
          </div>

          <h3 style={{ marginTop: 16 }}>3) Withdraw (doar NEFINANTAT)</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Withdraw amount (e.g. 10)"
              style={{ padding: 8, width: 260 }}
            />
            <button onClick={withdraw} disabled={withdrawing}>
              {withdrawing ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>

        <hr style={{ margin: "24px 0" }} />
        <h2>Owner actions</h2>
        <p><b>Crowd owner:</b> {cfOwner}</p>
        <p><b>You are owner:</b> {isOwner ? "YES" : "NO"}</p>

        <div style={{ opacity: isOwner ? 1 : 0.5 }}>
          <h3>0) Add Beneficiary (DistributeFunding)</h3>
          <p>
            <b>Beneficiaries:</b> {benCount}{" "}
            {totalWeightBps !== "N/A" && (
              <>
                | <b>Total weight (bps):</b> {totalWeightBps} / 10000
              </>
            )}
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={benAddress}
              onChange={(e) => setBenAddress(e.target.value)}
              placeholder="Beneficiary address (0x...)"
              style={{ padding: 8, width: 420 }}
              disabled={!isOwner}
            />
            <input
              value={benWeight}
              onChange={(e) => setBenWeight(e.target.value)}
              placeholder="weightBps (ex 6000 = 60%)"
              style={{ padding: 8, width: 220 }}
              disabled={!isOwner}
            />
            <button onClick={addBeneficiary} disabled={!isOwner || addingBen}>
              {addingBen ? "Adding..." : "Add Beneficiary"}
            </button>
          </div>
          <h3>1) Buy Sponsor Tokens</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={sponsorBuyAmount}
              onChange={(e) => setSponsorBuyAmount(e.target.value)}
              placeholder="Sponsor buy amount (e.g. 200)"
              style={{ padding: 8, width: 260 }}
              disabled={!isOwner}
            />
            <button onClick={buySponsorTokens} disabled={!isOwner || buyingSponsor}>
              {buyingSponsor ? "Buying..." : "Buy for SponsorFunding"}
            </button>
          </div>

          <h3 style={{ marginTop: 16 }}>2) Request Sponsorship</h3>
          <button onClick={requestSponsorship} disabled={!isOwner || requestingSponsor}>
            {requestingSponsor ? "Requesting..." : "requestSponsorship()"}
          </button>

          <h3 style={{ marginTop: 16 }}>3) Transfer To Distribute</h3>
          <button onClick={transferToDistribute} disabled={!isOwner || transferringDist}>
            {transferringDist ? "Transferring..." : "transferToDistribute()"}
          </button>
        </div>
        
        
        <hr style={{ margin: "24px 0" }} />

        <h2>Beneficiary actions</h2>

        <button onClick={claim}>
          claim()
        </button>

        <p style={{ opacity: 0.7 }}>
          (doar beneficiarii pot apela claim o singura data)
        </p>


          <p style={{ marginTop: 12, opacity: 0.8 }}>
            CrowdFunding contract: {ADDRESSES.crowd}
          </p>
        </>
      )}
    </div>
  );
}

export default App;
