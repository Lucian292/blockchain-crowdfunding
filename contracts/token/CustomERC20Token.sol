// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Token ERC-20 + cumparare la pret fix.
 * - Mint initial catre adresa contractului (rezerva de vanzare)
 * - Pretul este in wei per "unitate minima" (wei per 1 token-wei, adica per 10^-decimals).
 */
contract CustomERC20Token is ERC20, Ownable {
    uint256 public pricePerUnitWei; // pret per 1 unitate minima (smallest unit)

    event PriceUpdated(uint256 newPricePerUnitWei);
    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidWei);
    event EtherWithdrawn(address indexed to, uint256 amountWei);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,       // in unitati minime (include decimals)
        uint256 pricePerUnitWei_      // wei per unitate minima
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _mint(address(this), initialSupply_);
        pricePerUnitWei = pricePerUnitWei_;
    }

    function setPricePerUnitWei(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "price=0");
        pricePerUnitWei = newPrice;
        emit PriceUpdated(newPrice);
    }

    /**
     * Cumpara tokenAmount (in unitati minime). Necesita exact msg.value = tokenAmount * pricePerUnitWei.
     */
    function buyTokens(uint256 tokenAmount) external payable {
        require(tokenAmount > 0, "amount=0");
        uint256 cost = tokenAmount * pricePerUnitWei;
        require(msg.value == cost, "bad value");
        require(balanceOf(address(this)) >= tokenAmount, "not enough tokens");

        _transfer(address(this), msg.sender, tokenAmount);
        emit TokensPurchased(msg.sender, tokenAmount, msg.value);
    }

    function withdrawEther(address payable to, uint256 amountWei) external onlyOwner {
        require(to != address(0), "to=0");
        require(address(this).balance >= amountWei, "no ether");
        (bool ok, ) = to.call{value: amountWei}("");
        require(ok, "transfer failed");
        emit EtherWithdrawn(to, amountWei);
    }

    receive() external payable {}
}
