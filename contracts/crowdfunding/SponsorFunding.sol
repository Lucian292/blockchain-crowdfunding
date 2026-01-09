// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IToken.sol";

interface IBuyableToken {
    function buyTokens(uint256 tokenAmount) external payable;
}

/**
 * SponsorFunding:
 * - tine tokenuri pentru sponsorizare
 * - procent fix (ex: 10 = 10%)
 * - portofel independent, oricine poate cumpara tokenuri pentru sponsorizare
 * - este apelat de CrowdFunding cand colectarea s-a incheiat
 */
contract SponsorFunding is Ownable {
    IToken public immutable token;
    uint256 public immutable sponsorPercent; // 0..100

    event SponsorBoughtTokens(uint256 tokenAmount, uint256 paidWei);
    event SponsorshipAttempt(address indexed crowdFunding, uint256 baseAmount, uint256 needed, uint256 sent);

    constructor(address token_, uint256 sponsorPercent_) Ownable(msg.sender) {
        require(token_ != address(0), "token=0");
        require(sponsorPercent_ <= 100, "percent>100");
        token = IToken(token_);
        sponsorPercent = sponsorPercent_;
    }

    /**
     * Orice adresa poate cumpara tokenuri pentru sponsorizari.
     * SponsorFunding este un portofel independent, fara restrictii de ownership.
     * Tokenul trebuie sa aiba buyTokens(uint256) payable.
     */
    function buySponsorTokens(uint256 tokenAmount) external payable {
        require(tokenAmount > 0, "amount=0");
        IBuyableToken(address(token)).buyTokens{value: msg.value}(tokenAmount);
        emit SponsorBoughtTokens(tokenAmount, msg.value);
    }

    /**
     * Apelat de CrowdFunding (recomandat: doar CrowdFunding sa apeleze).
     * Returneaza cat a sponsorizat efectiv (0 daca nu are suficient).
     */
    function sponsor(address crowdFunding, uint256 collectedAmount) external returns (uint256 sponsored) {
        require(crowdFunding != address(0), "cf=0");
        // optional, strict: doar contractul crowdFunding poate apela pentru el insusi
        require(msg.sender == crowdFunding, "only CF");

        uint256 needed = (collectedAmount * sponsorPercent) / 100;
        uint256 bal = token.balanceOf(address(this));

        if (needed == 0 || bal < needed) {
            emit SponsorshipAttempt(crowdFunding, collectedAmount, needed, 0);
            return 0;
        }

        bool ok = token.transfer(crowdFunding, needed);
        require(ok, "transfer failed");
        emit SponsorshipAttempt(crowdFunding, collectedAmount, needed, needed);
        return needed;
    }
}
