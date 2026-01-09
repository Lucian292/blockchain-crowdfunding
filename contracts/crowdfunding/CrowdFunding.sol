// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IToken.sol";

interface ISponsorFunding {
    function sponsor(address crowdFunding, uint256 collectedAmount) external returns (uint256 sponsored);
}

interface IDistributeFunding {
    function notifyFundsReceived(uint256 totalAmount) external;
}

/**
 * CrowdFunding:
 * - NEFINANTAT: permite contribute + withdraw
 * - PREFINANTAT: goal atins, blocat depuneri/retrageri
 * - FINANTAT: dupa incercarea de sponsorizare (cu sau fara rezultat)
 * - apoi owner transfera suma in DistributeFunding
 */
contract CrowdFunding is Ownable, ReentrancyGuard {
    enum FundingState { NEFINANTAT, PREFINANTAT, FINANTAT }

    IToken public immutable token;
    uint256 public immutable fundingGoal;

    FundingState public state;

    address public sponsorFunding;
    address public distributeFunding;

    uint256 public totalCollected; // suma stransa (fara/plus sponsorizare, in functie de moment)
    bool public sponsorshipAttempted;
    bool public transferredToDistribute;

    mapping(address => uint256) public contributions;

    event Contributed(address indexed contributor, uint256 amount);
    event Withdrawn(address indexed contributor, uint256 amount);
    event GoalReached(uint256 totalCollected);
    event SponsorshipRequested(uint256 sponsoredAmount, uint256 newTotal);
    event TransferredToDistribute(address indexed distribute, uint256 amount);

    constructor(
        address token_,
        uint256 fundingGoal_,
        address sponsorFunding_,
        address distributeFunding_,
        address owner_
    ) Ownable(owner_ != address(0) ? owner_ : msg.sender) {
        require(token_ != address(0), "token=0");
        require(fundingGoal_ > 0, "goal=0");

        token = IToken(token_);
        fundingGoal = fundingGoal_;

        sponsorFunding = sponsorFunding_;
        distributeFunding = distributeFunding_;

        state = FundingState.NEFINANTAT;
    }

    function getStateString() external view returns (string memory) {
        if (state == FundingState.NEFINANTAT) return "nefinantat";
        if (state == FundingState.PREFINANTAT) return "prefinantat";
        return "finantat";
    }

    function setSponsorFunding(address sponsorFunding_) external onlyOwner {
        sponsorFunding = sponsorFunding_;
    }

    function setDistributeFunding(address distributeFunding_) external onlyOwner {
        distributeFunding = distributeFunding_;
    }

    // Contributie: user trebuie sa faca approve inainte
    function contribute(uint256 amount) external nonReentrant {
        require(state == FundingState.NEFINANTAT, "not allowed");
        require(amount > 0, "amount=0");

        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");

        contributions[msg.sender] += amount;
        totalCollected += amount;

        emit Contributed(msg.sender, amount);

        if (totalCollected >= fundingGoal) {
            state = FundingState.PREFINANTAT;
            emit GoalReached(totalCollected);
        }
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(state == FundingState.NEFINANTAT, "not allowed");
        require(amount > 0, "amount=0");
        uint256 c = contributions[msg.sender];
        require(c >= amount, "insufficient contribution");

        contributions[msg.sender] = c - amount;
        totalCollected -= amount;

        bool ok = token.transfer(msg.sender, amount);
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * Dupa ce goal e atins, owner cere sponsorizarea.
     * Dupa apel, trecem in FINANTAT indiferent daca sponsorizeaza sau nu.
     */
    function requestSponsorship() external onlyOwner nonReentrant {
        require(state == FundingState.PREFINANTAT, "not pre-funded");
        require(!sponsorshipAttempted, "already attempted");
        require(sponsorFunding != address(0), "sponsor=0");

        sponsorshipAttempted = true;

        uint256 sponsored = ISponsorFunding(sponsorFunding).sponsor(address(this), totalCollected);
        totalCollected += sponsored;

        state = FundingState.FINANTAT;
        emit SponsorshipRequested(sponsored, totalCollected);
    }

    /**
     * Dupa sponsorizare (sau incercare), owner transfera suma catre DistributeFunding.
     */
    function transferToDistribute() external onlyOwner nonReentrant {
        require(state == FundingState.FINANTAT, "not funded");
        require(!transferredToDistribute, "already transferred");
        require(distributeFunding != address(0), "dist=0");

        transferredToDistribute = true;

        bool ok = token.transfer(distributeFunding, totalCollected);
        require(ok, "transfer failed");

        // notifica DistributeFunding ca poate deschide claims
        IDistributeFunding(distributeFunding).notifyFundsReceived(totalCollected);

        emit TransferredToDistribute(distributeFunding, totalCollected);
    }
}
