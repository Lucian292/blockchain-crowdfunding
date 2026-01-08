export const factoryAbi = [
  "function createCampaign(address token_, uint256 fundingGoal_, address sponsorFunding_, address distributeFunding_) returns (address)",
  "function campaignCount() view returns (uint256)",
  "function getAllCampaigns() view returns (address[])",
  "function isCampaign(address) view returns (bool)",
  "event CampaignCreated(address indexed campaign, address indexed owner, address indexed token, uint256 fundingGoal)",
] as const;
