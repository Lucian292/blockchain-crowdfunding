import { expect } from "chai";
import { network } from "hardhat";

describe("Crowdfunding system", function () {
  it("should go through states and allow claims once", async function () {
    const { ethers } = await network.connect();
    const [deployer, alice, bob, ben1, ben2] = await ethers.getSigners();

    // Deploy Token
    const Token = await ethers.getContractFactory("CustomERC20Token");
    const initialSupply = ethers.parseUnits("1000000", 18);

    // 1 token = 0.001 ETH => pricePerUnitWei = 0.001 ETH / 1e18
    const pricePerUnitWei =
      ethers.parseEther("0.001") / (BigInt(10) ** BigInt(18));

    const token = (await Token.deploy(
      "EduToken",
      "EDU",
      initialSupply,
      pricePerUnitWei
    )) as any;
    await token.waitForDeployment();

    // Deploy SponsorFunding (10%)
    const Sponsor = await ethers.getContractFactory("SponsorFunding");
    const sponsor = (await Sponsor.deploy(await token.getAddress(), 10)) as any;
    await sponsor.waitForDeployment();

    // Deploy DistributeFunding
    const Dist = await ethers.getContractFactory("DistributeFunding");
    const dist = (await Dist.deploy(await token.getAddress())) as any;
    await dist.waitForDeployment();

    // Deploy CrowdFunding (goal 1000)
    const Crowd = await ethers.getContractFactory("CrowdFunding");
    const goal = ethers.parseUnits("1000", 18);

    const crowd = (await Crowd.deploy(
      await token.getAddress(),
      goal,
      await sponsor.getAddress(),
      await dist.getAddress()
    )) as any;
    await crowd.waitForDeployment();

    // Restriction for notify
    await (await dist.setCrowdFunding(await crowd.getAddress())).wait();

    // Add beneficiaries (60% / 30%)
    await (await dist.addBeneficiary(ben1.address, 6000)).wait();
    await (await dist.addBeneficiary(ben2.address, 3000)).wait();

    // Initially NEFINANTAT
    expect(await crowd.getStateString()).to.equal("nefinantat");

    // Buy tokens for contributors
    const buyAlice = ethers.parseUnits("600", 18);
    const buyBob = ethers.parseUnits("600", 18);

    await (
      await token.connect(alice).buyTokens(buyAlice, { value: buyAlice * pricePerUnitWei })
    ).wait();
    await (
      await token.connect(bob).buyTokens(buyBob, { value: buyBob * pricePerUnitWei })
    ).wait();

    // Contribute
    const contribAlice = ethers.parseUnits("550", 18);
    const contribBob = ethers.parseUnits("500", 18);

    await (await token.connect(alice).approve(await crowd.getAddress(), contribAlice)).wait();
    await (await crowd.connect(alice).contribute(contribAlice)).wait();

    expect(await crowd.getStateString()).to.equal("nefinantat");

    await (await token.connect(bob).approve(await crowd.getAddress(), contribBob)).wait();
    await (await crowd.connect(bob).contribute(contribBob)).wait();

    expect(await crowd.getStateString()).to.equal("prefinantat");

    // Can't withdraw now (withdraw only allowed in NEFINANTAT)
    await expect(
      crowd.connect(alice).withdraw(ethers.parseUnits("1", 18))
    ).to.be.revertedWith("not allowed");

    // Fund sponsor: owner buys sponsor tokens (SponsorFunding owner = deployer)
    const sponsorBuy = ethers.parseUnits("200", 18);
    await (
      await sponsor.buySponsorTokens(sponsorBuy, { value: sponsorBuy * pricePerUnitWei })
    ).wait();

    // Request sponsorship
    await (await crowd.requestSponsorship()).wait();
    expect(await crowd.getStateString()).to.equal("finantat");

    // Transfer to distribute
    await (await crowd.transferToDistribute()).wait();

    // Claims: once only
    const b1Before = await token.balanceOf(ben1.address);
    await (await dist.connect(ben1).claim()).wait();
    const b1After = await token.balanceOf(ben1.address);

    expect(b1After).to.be.gt(b1Before);

    await expect(dist.connect(ben1).claim()).to.be.revertedWith("already claimed");

    // ben2 claim
    await (await dist.connect(ben2).claim()).wait();
  });

  it("should allow partial withdraw before goal", async function () {
    const { ethers } = await network.connect();
    const [, alice] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("CustomERC20Token");
    const initialSupply = ethers.parseUnits("1000000", 18);
    const pricePerUnitWei =
      ethers.parseEther("0.001") / (BigInt(10) ** BigInt(18));

    const token = (await Token.deploy(
      "EduToken",
      "EDU",
      initialSupply,
      pricePerUnitWei
    )) as any;
    await token.waitForDeployment();

    const Sponsor = await ethers.getContractFactory("SponsorFunding");
    const sponsor = (await Sponsor.deploy(await token.getAddress(), 10)) as any;
    await sponsor.waitForDeployment();

    const Dist = await ethers.getContractFactory("DistributeFunding");
    const dist = (await Dist.deploy(await token.getAddress())) as any;
    await dist.waitForDeployment();

    const Crowd = await ethers.getContractFactory("CrowdFunding");
    const goal = ethers.parseUnits("1000", 18);

    const crowd = (await Crowd.deploy(
      await token.getAddress(),
      goal,
      await sponsor.getAddress(),
      await dist.getAddress()
    )) as any;
    await crowd.waitForDeployment();

    // buy + approve + contribute
    const buy = ethers.parseUnits("200", 18);
    await (await token.connect(alice).buyTokens(buy, { value: buy * pricePerUnitWei })).wait();

    const contrib = ethers.parseUnits("100", 18);
    await (await token.connect(alice).approve(await crowd.getAddress(), contrib)).wait();
    await (await crowd.connect(alice).contribute(contrib)).wait();

    // withdraw partial
    const w = ethers.parseUnits("40", 18);
    await (await crowd.connect(alice).withdraw(w)).wait();

    expect(await crowd.contributions(alice.address)).to.equal(contrib - w);
  });
});
