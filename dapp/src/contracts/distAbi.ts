export const distAbi = [
  "function addBeneficiary(address who, uint16 weightBps)",
  "function claim()",
  "function beneficiaries(address) view returns (uint16 weightBps, bool exists, bool claimed)",
  "function totalReceived() view returns (uint256)",
  "function fundingNotified() view returns (bool)",
  "function totalWeightBps() view returns (uint16)",
] as const;
