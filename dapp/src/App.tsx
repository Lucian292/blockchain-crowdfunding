import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "./contracts/addresses";
import { tokenAbi } from "./contracts/tokenAbi";

function App() {
  const [account, setAccount] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("");

  const [tokenSymbol, setTokenSymbol] = useState<string>("EDU");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [pricePerToken, setPricePerToken] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");

  const [connecting, setConnecting] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [buying, setBuying] = useState(false);

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return "Unknown error";
  }

  async function getProvider() {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }
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

      await refreshToken(addr);
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }

  async function refreshToken(addr?: string) {
    const user = addr ?? account;
    if (!user) return;

    try {
      setLoadingToken(true);

      const provider = await getProvider();
      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, provider);

      const [sym, dec, bal, ppu] = await Promise.all([
        token.symbol(),
        token.decimals(),
        token.balanceOf(user),
        token.pricePerUnitWei(),
      ]);

      setTokenSymbol(sym);
      setTokenBalance(ethers.formatUnits(bal, dec));

      const pricePerTokenWei = BigInt(ppu) * (BigInt(10) ** BigInt(dec));
      setPricePerToken(ethers.formatEther(pricePerTokenWei));
    } finally {
      setLoadingToken(false);
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

      const dec: number = await token.decimals();
      const amountUnits = ethers.parseUnits(buyAmount, dec);

      const ppu: bigint = await token.pricePerUnitWei();
      const costWei = amountUnits * ppu;

      const tx = await token.buyTokens(amountUnits, { value: costWei });
      await tx.wait();

      const balEth = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(balEth));
      await refreshToken();
      setBuyAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setBuying(false);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 900 }}>
      <h1>Blockchain Crowdfunding DApp</h1>

      {!account ? (
        <button onClick={connectWallet} disabled={connecting}>
          {connecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <>
          <p><b>Account:</b> {account}</p>
          <p><b>ETH Balance:</b> {ethBalance}</p>

          <hr />

          <h2>Token</h2>
          <p><b>Symbol:</b> {tokenSymbol}</p>
          <p><b>Balance:</b> {tokenBalance}</p>
          <p><b>Price:</b> {pricePerToken} ETH / token</p>

          <div style={{ display: "flex", gap: 12 }}>
            <input
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="Amount (e.g. 10)"
            />
            <button onClick={buyTokens} disabled={buying}>
              {buying ? "Buying..." : "Buy Tokens"}
            </button>
            <button onClick={() => refreshToken()} disabled={loadingToken}>
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
