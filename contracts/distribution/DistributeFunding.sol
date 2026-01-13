// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IToken.sol";

/**
 * DistributeFunding:
 * - owner adauga beneficiari cu ponderi (basis points din 10000 = 100%) PER CAMPAIGN
 * - suma ponderilor NU poate depasi 10000 (100%) per campaign
 * - CrowdFunding transfera tokenuri aici si cheama notifyFundsReceived()
 * - fiecare beneficiar poate claim o singura data per campaign
 */
contract DistributeFunding is Ownable, ReentrancyGuard {
    IToken public immutable token;

    // folosim basis points: 10000 = 100%
    struct Beneficiary {
        uint16 weightBps; // 0..10000
        bool exists;
        bool claimed;
    }

    // Per campaign: mapping(campaignAddress => mapping(beneficiaryAddress => Beneficiary))
    mapping(address => mapping(address => Beneficiary)) public campaignBeneficiaries;
    // Per campaign: list of beneficiary addresses
    mapping(address => address[]) public campaignBeneficiaryList;
    // Per campaign: total weight in basis points
    mapping(address => uint16) public campaignTotalWeightBps;

    // Per campaign: total received and notification status
    mapping(address => uint256) public campaignTotalReceived;
    mapping(address => bool) public campaignFundingNotified;

    // optional: poti seta crowdFunding, ca sa restrictionezi notify
    address public crowdFunding;

    event BeneficiaryAdded(address indexed campaign, address indexed who, uint16 weightBps);
    event CrowdFundingSet(address indexed cf);
    event FundsNotified(address indexed campaign, uint256 totalAmount);
    event Claimed(address indexed campaign, address indexed who, uint256 amount);

    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "token=0");
        token = IToken(token_);
    }

    function setCrowdFunding(address cf) external onlyOwner {
        crowdFunding = cf;
        emit CrowdFundingSet(cf);
    }
    
    // Allow campaign owner to set crowdFunding for their campaign
    function setCrowdFundingForCampaign(address cf) external {
        require(cf != address(0), "cf=0");
        
        // Verify that msg.sender is the owner of the campaign
        (bool success, bytes memory data) = cf.staticcall(
            abi.encodeWithSignature("owner()")
        );
        require(success && data.length >= 32, "invalid campaign");
        address campaignOwner = abi.decode(data, (address));
        require(msg.sender == campaignOwner, "not campaign owner");
        
        // Verify that the campaign uses this DistributeFunding
        (bool success2, bytes memory data2) = cf.staticcall(
            abi.encodeWithSignature("distributeFunding()")
        );
        require(success2 && data2.length >= 32, "invalid campaign");
        address campaignDistFunding = abi.decode(data2, (address));
        require(campaignDistFunding == address(this), "wrong DistributeFunding");
        
        crowdFunding = cf;
        emit CrowdFundingSet(cf);
    }

    // New function: add beneficiary with campaign address verification
    function addBeneficiaryForCampaign(address who, uint16 weightBps, address campaignAddress) external {
        // Allow either the contract owner OR the owner of the specified campaign
        bool isContractOwner = msg.sender == owner();
        bool isCampaignOwner = false;
        
        if (campaignAddress != address(0)) {
            // Verify the campaign uses this DistributeFunding
            (bool success1, bytes memory data1) = campaignAddress.staticcall(
                abi.encodeWithSignature("distributeFunding()")
            );
            if (success1 && data1.length >= 32) {
                address campaignDistFunding = abi.decode(data1, (address));
                if (campaignDistFunding == address(this)) {
                    // Campaign uses this DistributeFunding, check ownership
                    (bool success2, bytes memory data2) = campaignAddress.staticcall(
                        abi.encodeWithSignature("owner()")
                    );
                    if (success2 && data2.length >= 32) {
                        address campaignOwner = abi.decode(data2, (address));
                        isCampaignOwner = msg.sender == campaignOwner;
                    }
                }
            }
        }
        
        require(isContractOwner || isCampaignOwner, "not authorized");
        require(who != address(0), "who=0");
        require(weightBps > 0 && weightBps <= 10000, "bad weight");
        require(!campaignBeneficiaries[campaignAddress][who].exists, "exists");

        // Fix: nu permitem suma ponderilor > 100% per campaign
        require(uint256(campaignTotalWeightBps[campaignAddress]) + uint256(weightBps) <= 10000, "total weight > 100%");
        campaignTotalWeightBps[campaignAddress] += weightBps;

        campaignBeneficiaries[campaignAddress][who] = Beneficiary({
            weightBps: weightBps,
            exists: true,
            claimed: false
        });
        campaignBeneficiaryList[campaignAddress].push(who);

        emit BeneficiaryAdded(campaignAddress, who, weightBps);
    }

    /**
     * Chema CrowdFunding dupa transferul tokenurilor.
     * Daca vrei strict: setezi crowdFunding si verifici msg.sender.
     */
    function notifyFundsReceived(uint256 totalAmount) external {
        address campaign = msg.sender;
        
        if (crowdFunding != address(0)) {
            require(campaign == crowdFunding, "only CF");
        }
        require(!campaignFundingNotified[campaign], "already notified");
        require(totalAmount > 0, "amount=0");

        // optional (sigur): macar un beneficiar pentru aceasta campanie
        require(campaignTotalWeightBps[campaign] > 0, "no beneficiaries");

        campaignFundingNotified[campaign] = true;
        campaignTotalReceived[campaign] = totalAmount;

        emit FundsNotified(campaign, totalAmount);
    }

    function claim(address campaignAddress) external nonReentrant {
        require(campaignFundingNotified[campaignAddress], "not ready");
        Beneficiary storage b = campaignBeneficiaries[campaignAddress][msg.sender];
        require(b.exists, "not beneficiary");
        require(!b.claimed, "already claimed");

        uint256 amount = (campaignTotalReceived[campaignAddress] * uint256(b.weightBps)) / 10000;
        require(amount > 0, "amount=0");

        b.claimed = true;

        bool ok = token.transfer(msg.sender, amount);
        require(ok, "transfer failed");

        emit Claimed(campaignAddress, msg.sender, amount);
    }

    function beneficiariesCount(address campaignAddress) external view returns (uint256) {
        return campaignBeneficiaryList[campaignAddress].length;
    }
    
    function totalWeightBps(address campaignAddress) external view returns (uint16) {
        return campaignTotalWeightBps[campaignAddress];
    }
    
    function beneficiaries(address campaignAddress, address beneficiaryAddress) external view returns (uint16 weightBps, bool exists, bool claimed) {
        Beneficiary storage b = campaignBeneficiaries[campaignAddress][beneficiaryAddress];
        return (b.weightBps, b.exists, b.claimed);
    }
    
    function beneficiaryList(address campaignAddress, uint256 index) external view returns (address) {
        return campaignBeneficiaryList[campaignAddress][index];
    }
}
