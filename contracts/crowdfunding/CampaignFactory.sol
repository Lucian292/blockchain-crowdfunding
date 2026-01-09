// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CrowdFunding.sol";

/**
 * CampaignFactory:
 * - Allows anyone to create new crowdfunding campaigns
 * - Tracks all created campaigns
 * - Provides a way to query campaigns by index
 */
contract CampaignFactory {
    address[] public campaigns;
    mapping(address => bool) public isCampaign;

    event CampaignCreated(
        address indexed campaign,
        address indexed owner,
        address indexed token,
        uint256 fundingGoal
    );

    /**
     * @notice Creates a new CrowdFunding campaign
     * @param token_ The token contract address
     * @param fundingGoal_ The funding goal in token units
     * @param sponsorFunding_ The SponsorFunding contract address
     * @param distributeFunding_ The DistributeFunding contract address
     * @return The address of the newly created campaign
     */
    function createCampaign(
        address token_,
        uint256 fundingGoal_,
        address sponsorFunding_,
        address distributeFunding_
    ) external returns (address) {
        CrowdFunding campaign = new CrowdFunding(
            token_,
            fundingGoal_,
            sponsorFunding_,
            distributeFunding_,
            msg.sender  // Pass the caller as the owner
        );

        address campaignAddress = address(campaign);
        campaigns.push(campaignAddress);
        isCampaign[campaignAddress] = true;

        emit CampaignCreated(
            campaignAddress,
            msg.sender,
            token_,
            fundingGoal_
        );

        return campaignAddress;
    }

    /**
     * @notice Returns the total number of campaigns created
     */
    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    /**
     * @notice Returns all campaign addresses
     */
    function getAllCampaigns() external view returns (address[] memory) {
        return campaigns;
    }
}
