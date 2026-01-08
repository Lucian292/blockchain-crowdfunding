export const tokenAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function pricePerUnitWei() view returns (uint256)",
  "function buyTokens(uint256 tokenAmount) payable",
] as const;
