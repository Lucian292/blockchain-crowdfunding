import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [deployer, alice, bob, ben1, ben2] = await ethers.getSigners();

  // Adresele din deploy-ul tau (le poti lasa hardcodate sau le pui din env)
  const TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const SPONSOR = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const DISTRIBUTE = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const CROWD = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

const token = (await ethers.getContractAt("CustomERC20Token", TOKEN)) as any;
const sponsor = (await ethers.getContractAt("SponsorFunding", SPONSOR)) as any;
const dist = (await ethers.getContractAt("DistributeFunding", DISTRIBUTE)) as any;
const crowd = (await ethers.getContractAt("CrowdFunding", CROWD)) as any;

  // 1) Seteaza beneficiari (owner = deployer)
  // 60% si 30% (restul 10% ramane in contract, permis de cerinta)
  await (await dist.addBeneficiary(ben1.address, 6000)).wait();
  await (await dist.addBeneficiary(ben2.address, 3000)).wait();

  // 2) Contribuitorii cumpara tokenuri (din rezerva tokenului)
  const buyAlice = ethers.parseUnits("600", 18);
  const buyBob = ethers.parseUnits("600", 18);

  const pricePerUnitWei = await token.pricePerUnitWei();
  const costAlice = buyAlice * pricePerUnitWei;
  const costBob = buyBob * pricePerUnitWei;

  await (await token.connect(alice).buyTokens(buyAlice, { value: costAlice })).wait();
  await (await token.connect(bob).buyTokens(buyBob, { value: costBob })).wait();

  // 3) Approve + contribute in CrowdFunding (goal = 1000)
  const contribAlice = ethers.parseUnits("550", 18);
  const contribBob = ethers.parseUnits("500", 18);

  await (await token.connect(alice).approve(CROWD, contribAlice)).wait();
  await (await crowd.connect(alice).contribute(contribAlice)).wait();

  console.log("State after Alice:", await crowd.getStateString());

  await (await token.connect(bob).approve(CROWD, contribBob)).wait();
  await (await crowd.connect(bob).contribute(contribBob)).wait();

  console.log("State after Bob:", await crowd.getStateString()); // ar trebui "prefinantat"

  // 4) Sponsor cumpara tokenuri pentru sponsorizare si sponsorizeaza
  // sponsorPercent = 10%, collected ~1050 => sponsor needs ~105 tokens
  const sponsorBuy = ethers.parseUnits("200", 18); // cumpara mai mult ca sa fie sigur
  const sponsorCost = sponsorBuy * pricePerUnitWei;

  await (await sponsor.buySponsorTokens(sponsorBuy, { value: sponsorCost })).wait();

  // Owner cere sponsorizarea
  await (await crowd.requestSponsorship()).wait();
  console.log("State after sponsorship attempt:", await crowd.getStateString()); // "finantat"

  // 5) Transfer catre DistributeFunding
  await (await crowd.transferToDistribute()).wait();

  // 6) Beneficiarii claim
  const balBefore1 = await token.balanceOf(ben1.address);
  const balBefore2 = await token.balanceOf(ben2.address);

  await (await dist.connect(ben1).claim()).wait();
  await (await dist.connect(ben2).claim()).wait();

  const balAfter1 = await token.balanceOf(ben1.address);
  const balAfter2 = await token.balanceOf(ben2.address);

  console.log("Beneficiary1 gained:", (balAfter1 - balBefore1).toString());
  console.log("Beneficiary2 gained:", (balAfter2 - balBefore2).toString());

  // 7) Verificari rapide
  console.log("Crowd totalCollected:", (await crowd.totalCollected()).toString());
  console.log("Distribute token balance:", (await token.balanceOf(DISTRIBUTE)).toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
