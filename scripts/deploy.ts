import { network } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
  const { ethers } = await network.connect(); // <-- asta e cheia in Hardhat 3

  const [deployer] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("CustomERC20Token");
  const initialSupply = ethers.parseUnits("1000000", 18);

  const tokenPricePerTokenEth = "0.001";
  const pricePerUnitWei =
    ethers.parseEther(tokenPricePerTokenEth) / (BigInt(10) ** BigInt(18));

  const token = await Token.deploy("EduToken", "EDU", initialSupply, pricePerUnitWei);
  await token.waitForDeployment();

  const Sponsor = await ethers.getContractFactory("SponsorFunding");
  const sponsor = await Sponsor.deploy(await token.getAddress(), 10);
  await sponsor.waitForDeployment();

  const Dist = await ethers.getContractFactory("DistributeFunding");
  const dist = await Dist.deploy(await token.getAddress());
  await dist.waitForDeployment();

  const Crowd = await ethers.getContractFactory("CrowdFunding");
  const goal = ethers.parseUnits("1000", 18);

  const crowd = await Crowd.deploy(
    await token.getAddress(),
    goal,
    await sponsor.getAddress(),
    await dist.getAddress(),
    deployer.address  // Owner is the deployer
  );
  await crowd.waitForDeployment();

  const tx = await dist.setCrowdFunding(await crowd.getAddress());
  await tx.wait();

  // Deploy CampaignFactory
  const Factory = await ethers.getContractFactory("CampaignFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  // Get all addresses
  const tokenAddress = await token.getAddress();
  const sponsorAddress = await sponsor.getAddress();
  const distAddress = await dist.getAddress();
  const crowdAddress = await crowd.getAddress();
  const factoryAddress = await factory.getAddress();

  console.log("Deployer:", deployer.address);
  console.log("Token:", tokenAddress);
  console.log("SponsorFunding:", sponsorAddress);
  console.log("DistributeFunding:", distAddress);
  console.log("CrowdFunding:", crowdAddress);
  console.log("CampaignFactory:", factoryAddress);

  // Update addresses.ts file
  const addressesContent = `export const ADDRESSES = {
  token: "${tokenAddress}",
  sponsor: "${sponsorAddress}",
  distribute: "${distAddress}",
  crowd: "${crowdAddress}",
  factory: "${factoryAddress}",
} as const;
`;

  const addressesPath = join(process.cwd(), "dapp/src/contracts/addresses.ts");
  writeFileSync(addressesPath, addressesContent, "utf-8");
  
  console.log("\n✅ Addresses updated in dapp/src/contracts/addresses.ts");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
