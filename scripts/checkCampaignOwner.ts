import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  // Get campaign address from command line argument or use default
  const campaignAddress = process.argv[2] || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  
  if (!ethers.isAddress(campaignAddress)) {
    console.error("Invalid campaign address:", campaignAddress);
    process.exit(1);
  }

  console.log("=== Checking Campaign Owner ===");
  console.log("Campaign address:", campaignAddress);

  const Crowd = await ethers.getContractFactory("CrowdFunding");
  const campaign = Crowd.attach(campaignAddress) as any;

  try {
    // Get campaign details
    const owner = await campaign.owner();
    const fundingGoal = await campaign.fundingGoal();
    const totalCollected = await campaign.totalCollected();
    const state = await campaign.getStateString();
    const tokenAddress = await campaign.token();

    console.log("\n=== Campaign Information ===");
    console.log("Owner:", owner);
    console.log("Funding goal:", ethers.formatUnits(fundingGoal, 18), "tokens");
    console.log("Total collected:", ethers.formatUnits(totalCollected, 18), "tokens");
    console.log("State:", state);
    console.log("Token address:", tokenAddress);

    // Get signers to check if any of them is the owner
    const signers = await ethers.getSigners();
    console.log("\n=== Signers Check ===");
    signers.forEach((signer, index) => {
      const isOwner = signer.address.toLowerCase() === owner.toLowerCase();
      console.log(`Signer ${index} (${signer.address}): ${isOwner ? "✅ IS OWNER" : "❌ Not owner"}`);
    });

  } catch (error: any) {
    console.error("Error reading campaign:", error.message);
    console.error("\nPossible causes:");
    console.error("1. Campaign address is incorrect");
    console.error("2. Campaign is not deployed on this network");
    console.error("3. Network mismatch");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
