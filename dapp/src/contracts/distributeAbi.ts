export const distributeAbi = [
  "function addBeneficiaryForCampaign(address who, uint16 weightBps, address campaignAddress) external",
  "function beneficiariesCount(address campaignAddress) external view returns (uint256)",
  "function beneficiaryList(address campaignAddress, uint256 index) external view returns (address)",
  "function beneficiaries(address campaignAddress, address beneficiaryAddress) external view returns (uint16 weightBps, bool exists, bool claimed)",
  "function totalWeightBps(address campaignAddress) external view returns (uint16)",
  "function crowdFunding() external view returns (address)",
  "function setCrowdFunding(address cf) external",
  "function setCrowdFundingForCampaign(address cf) external",
  "function owner() external view returns (address)",

  "function campaignFundingNotified(address campaignAddress) external view returns (bool)",
  "function campaignTotalReceived(address campaignAddress) external view returns (uint256)",
  "function claim(address campaignAddress) external",
] as const;
