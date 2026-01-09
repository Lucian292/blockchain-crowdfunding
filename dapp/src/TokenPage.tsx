import { useState } from "react";
import { ethers } from "ethers";
import { ADDRESSES } from "./contracts/addresses";
import { tokenAbi } from "./contracts/tokenAbi";

interface TokenPageProps {
  account: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenBalance: string;
  pricePerToken: string;
  onRefresh: () => Promise<void>;
}

function TokenPage({
  tokenSymbol,
  tokenDecimals,
  tokenBalance,
  pricePerToken,
  onRefresh,
}: TokenPageProps) {
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [buying, setBuying] = useState(false);

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return "Unknown error";
  }

  async function getProvider() {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    return new ethers.BrowserProvider(window.ethereum);
  }

  async function buyTokens() {
    if (!buyAmount || Number(buyAmount) <= 0) {
      alert("Introdu o suma valida de token");
      return;
    }

    try {
      setBuying(true);

      const provider = await getProvider();
      
      // Validate token address exists
      if (!ADDRESSES.token || !ethers.isAddress(ADDRESSES.token)) {
        throw new Error("Token address is not configured. Please redeploy contracts.");
      }
      
      const tokenCode = await provider.getCode(ADDRESSES.token);
      if (tokenCode === "0x") {
        throw new Error(`Token contract does not exist at address ${ADDRESSES.token}. Please redeploy contracts.`);
      }

      const signer = await provider.getSigner();
      const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);

      const amountUnits = ethers.parseUnits(buyAmount, tokenDecimals);

      const ppu: bigint = await token.pricePerUnitWei();
      const costWei = amountUnits * ppu;

      const tx = await token.buyTokens(amountUnits, { value: costWei });
      await tx.wait();

      await onRefresh();
      setBuyAmount("");
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setBuying(false);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1000 }}>
      <h1>Token Operations</h1>

      <div>
        <h2>Token Information</h2>
        <p><b>Symbol:</b> {tokenSymbol}</p>
        <p><b>Balance:</b> {tokenBalance} {tokenSymbol}</p>
        <p><b>Price:</b> {pricePerToken} ETH / token</p>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <div>
        <h2>Buy Tokens</h2>
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
      </div>
    </div>
  );
}

export default TokenPage;
