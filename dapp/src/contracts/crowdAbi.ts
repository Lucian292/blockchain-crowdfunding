export const crowdAbi = [
  "function fundingGoal() view returns (uint256)",
  "function totalCollected() view returns (uint256)",
  "function contributions(address) view returns (uint256)",
  "function getStateString() view returns (string)",
  "function transferredToDistribute() view returns (bool)",
  "function distributeFunding() view returns (address)",

  "function contribute(uint256 amount)",
  "function withdraw(uint256 amount)",

  // owner actions
  "function owner() view returns (address)",
  "function requestSponsorship()",
  "function transferToDistribute()",
] as const;
