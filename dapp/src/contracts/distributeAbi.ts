export const distributeAbi = [
  "function addBeneficiary(address who, uint16 weightBps) external",
  "function beneficiariesCount() external view returns (uint256)",
  "function beneficiaryList(uint256) external view returns (address)",
  "function beneficiaries(address) external view returns (uint16 weightBps, bool exists, bool claimed)",
  "function totalWeightBps() external view returns (uint256)",
  "function crowdFunding() external view returns (address)",
  "function setCrowdFunding(address cf) external",

  "function fundingNotified() external view returns (bool)",
  "function totalReceived() external view returns (uint256)",
  "function claim() external",
] as const;
