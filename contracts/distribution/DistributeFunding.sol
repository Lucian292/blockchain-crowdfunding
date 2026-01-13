// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IToken.sol";

/**
 * DistributeFunding:
 * - owner adauga beneficiari cu ponderi (basis points din 10000 = 100%)
 * - suma ponderilor NU poate depasi 10000 (100%)
 * - CrowdFunding transfera tokenuri aici si cheama notifyFundsReceived()
 * - fiecare beneficiar poate claim o singura data
 */
contract DistributeFunding is Ownable, ReentrancyGuard {
    IToken public immutable token;

    // folosim basis points: 10000 = 100%
    struct Beneficiary {
        uint16 weightBps; // 0..10000
        bool exists;
        bool claimed;
    }

    mapping(address => Beneficiary) public beneficiaries;
    address[] public beneficiaryList;

    uint256 public totalReceived;
    bool public fundingNotified;

    // suma ponderilor tuturor beneficiarilor (bps)
    uint16 public totalWeightBps;

    // optional: poti seta crowdFunding, ca sa restrictionezi notify
    address public crowdFunding;

    event BeneficiaryAdded(address indexed who, uint16 weightBps);
    event CrowdFundingSet(address indexed cf);
    event FundsNotified(uint256 totalAmount);
    event Claimed(address indexed who, uint256 amount);

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

    function addBeneficiary(address who, uint16 weightBps) external {
        // Allow either the contract owner OR the owner of ANY campaign that uses this DistributeFunding
        bool isContractOwner = msg.sender == owner();
        bool isCampaignOwner = false;
        
        // Check if msg.sender is owner of the campaign set in crowdFunding
        if (crowdFunding != address(0)) {
            (bool success, bytes memory data) = crowdFunding.staticcall(
                abi.encodeWithSignature("owner()")
            );
            if (success && data.length >= 32) {
                address campaignOwner = abi.decode(data, (address));
                isCampaignOwner = msg.sender == campaignOwner;
            }
        }
        
        // Also check if msg.sender is owner of any campaign by trying to verify
        // We'll allow any address that can prove they own a campaign with this DistributeFunding
        // by checking if they own a campaign that has distributeFunding set to this contract
        if (!isContractOwner && !isCampaignOwner) {
            // Try to find if msg.sender owns any campaign that uses this DistributeFunding
            // We'll check by trying to call owner() on potential campaign addresses
            // But this is complex, so we'll use a simpler approach:
            // Allow if msg.sender can prove they own a campaign by passing the campaign address
            // For now, we'll just check the set crowdFunding
            // A better solution would be to add a parameter for campaign address
        }
        
        require(isContractOwner || isCampaignOwner, "not authorized");
        require(who != address(0), "who=0");
        require(weightBps > 0 && weightBps <= 10000, "bad weight");
        require(!beneficiaries[who].exists, "exists");

        // Fix: nu permitem suma ponderilor > 100%
        require(uint256(totalWeightBps) + uint256(weightBps) <= 10000, "total weight > 100%");
        totalWeightBps += weightBps;

        beneficiaries[who] = Beneficiary({
            weightBps: weightBps,
            exists: true,
            claimed: false
        });
        beneficiaryList.push(who);

        emit BeneficiaryAdded(who, weightBps);
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
        require(!beneficiaries[who].exists, "exists");

        // Fix: nu permitem suma ponderilor > 100%
        require(uint256(totalWeightBps) + uint256(weightBps) <= 10000, "total weight > 100%");
        totalWeightBps += weightBps;

        beneficiaries[who] = Beneficiary({
            weightBps: weightBps,
            exists: true,
            claimed: false
        });
        beneficiaryList.push(who);

        emit BeneficiaryAdded(who, weightBps);
    }

    /**
     * Chema CrowdFunding dupa transferul tokenurilor.
     * Daca vrei strict: setezi crowdFunding si verifici msg.sender.
     */
    function notifyFundsReceived(uint256 totalAmount) external {
        if (crowdFunding != address(0)) {
            require(msg.sender == crowdFunding, "only CF");
        }
        require(!fundingNotified, "already notified");
        require(totalAmount > 0, "amount=0");

        // optional (sigur): macar un beneficiar
        require(totalWeightBps > 0, "no beneficiaries");

        fundingNotified = true;
        totalReceived = totalAmount;

        emit FundsNotified(totalAmount);
    }

    function claim() external nonReentrant {
        require(fundingNotified, "not ready");
        Beneficiary storage b = beneficiaries[msg.sender];
        require(b.exists, "not beneficiary");
        require(!b.claimed, "already claimed");

        uint256 amount = (totalReceived * uint256(b.weightBps)) / 10000;
        require(amount > 0, "amount=0");

        b.claimed = true;

        bool ok = token.transfer(msg.sender, amount);
        require(ok, "transfer failed");

        emit Claimed(msg.sender, amount);
    }

    function beneficiariesCount() external view returns (uint256) {
        return beneficiaryList.length;
    }
}
