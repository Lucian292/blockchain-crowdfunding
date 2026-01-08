import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "./contracts/addresses";
import { tokenAbi } from "./contracts/tokenAbi";
import { crowdAbi } from "./contracts/crowdAbi";

function App() {
  const [account, setAccount] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("");

  // Token
  const [tokenSymbol, setTokenSymbol] = useState<string>("EDU");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [pricePerToken, setPricePerToken] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");

  // Crowdfunding
  const [cfState, setCfState] = useState<string>("-");
  const [cfGoal, setCfGoal] = useState<string>("0");
  const [cfTotal, setCfTotal] = useState<string>("0");
  const [myContribution, setMyContribution] = useState<string>("0");

  const [approveAmount, setApproveAmount] = useState<string>("");
  const [contributeAmount, setContributeAmount] = useState<string>("");

  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [approving, setApproving] = useState(false);
  const [contributing, setContributing] = useState(false);

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

      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));
      setTokenBalance(ethers.formatUnits(bal, dec));

      const pricePerTokenWei = BigInt(ppu) * (BigInt(10) ** BigInt(dec));
      setPricePerToken(ethers.formatEther(pricePerTokenWei));

      // CrowdFunding (read-only)
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, provider);

      const [stateStr, goal, total, mine] = await Promise.all([
        crowd.getStateString(),
        crowd.fundingGoal(),
        crowd.totalCollected(),
        crowd.contributions(user),
      ]);

      setCfState(stateStr);
      setCfGoal(ethers.formatUnits(goal, dec));
      setCfTotal(ethers.formatUnits(total, dec));
      setMyContribution(ethers.formatUnits(mine, dec));

      // ETH
      const eth = await provider.getBalance(user);
      setEthBalance(ethers.formatEther(eth));
    } finally {
      setLoading(false);
    }
  }

  async function buyTokens() {
    if (!buyAmount || Number(buyAmount) <= 0) {
      alert("Introdu o suma valida de token");
      return;
    }

    try {
      setBuying(true);

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);

      const amountUnits = ethers.parseUnits(buyAmount, tokenDecimals);

      const ppu: bigint = await token.pricePerUnitWei();
      const costWei = amountUnits * ppu;

      const tx = await token.buyTokens(amountUnits, { value: costWei });
      await tx.wait();

      await refreshAll();
      setBuyAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setBuying(false);
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

      // Verificam allowance (optional dar util pt UX)
      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
      const crowd = new ethers.Contract(ADDRESSES.crowd, crowdAbi, signer);

      const amountUnits = ethers.parseUnits(contributeAmount, tokenDecimals);
      const allowance: bigint = await token.allowance(account, ADDRESSES.crowd);

      if (allowance < amountUnits) {
        alert("Allowance insuficient. Fa approve inainte.");
        return;
      }

      const tx = await crowd.contribute(amountUnits);
      await tx.wait();

      await refreshAll();
      setContributeAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setContributing(false);
    }
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
          <p><b>Account:</b> {account}</p>
          <p><b>ETH Balance:</b> {ethBalance}</p>

          <button onClick={() => refreshAll()} disabled={loading} style={{ marginBottom: 16 }}>
            {loading ? "Refreshing..." : "Refresh All"}
          </button>

          <hr />

          <h2>Token</h2>
          <p><b>Symbol:</b> {tokenSymbol}</p>
          <p><b>Balance:</b> {tokenBalance}</p>
          <p><b>Price:</b> {pricePerToken} ETH / token</p>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="Buy amount (e.g. 10)"
              style={{ padding: 8, width: 220 }}
            />
            <button onClick={buyTokens} disabled={buying}>
              {buying ? "Buying..." : "Buy Tokens"}
            </button>
          </div>

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

          <p style={{ marginTop: 12, opacity: 0.8 }}>
            CrowdFunding contract: {ADDRESSES.crowd}
          </p>
        </>
      )}
    </div>
  );
}

export default App;
