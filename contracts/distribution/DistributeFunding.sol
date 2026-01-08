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

    function addBeneficiary(address who, uint16 weightBps) external onlyOwner {
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
