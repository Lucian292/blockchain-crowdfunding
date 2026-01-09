import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  // Get signers
  const [deployer, user] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("User (campaign creator):", user.address);

  // Get contract addresses (adjust these to your deployed addresses)
  const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const SPONSOR_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const DISTRIBUTE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  
  // Get Factory address (you need to deploy it first or use existing)
  // You can also pass it as argument: npx hardhat run scripts/createCampaign.ts --network localhost --factory 0x...
  const factoryAddress = process.env.FACTORY_ADDRESS || "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
  
  console.log("\n=== Creating Campaign ===");
  console.log("Factory address:", factoryAddress);
  console.log("Token address:", TOKEN_ADDRESS);
  console.log("Sponsor address:", SPONSOR_ADDRESS);
  console.log("Distribute address:", DISTRIBUTE_ADDRESS);

  // Get Factory contract
  const Factory = await ethers.getContractFactory("CampaignFactory");
  const factory = Factory.attach(factoryAddress) as any;

  // Set funding goal (in token units, e.g. 1000 tokens)
  const fundingGoal = ethers.parseUnits("1000", 18); // 1000 tokens with 18 decimals
  console.log("\nFunding goal:", ethers.formatUnits(fundingGoal, 18), "tokens");

  // Create campaign (user will be the owner)
  console.log("\nCreating campaign...");
  const tx = await factory.connect(user).createCampaign(
    TOKEN_ADDRESS,
    fundingGoal,
    SPONSOR_ADDRESS,
    DISTRIBUTE_ADDRESS
  );
  
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt?.blockNumber);

  // Get the created campaign address from event
  const event = receipt?.logs.find((log: any) => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed?.name === "CampaignCreated";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = factory.interface.parseLog(event);
    const campaignAddress = parsed?.args[0];
    const ownerFromEvent = parsed?.args[1];
    
    console.log("\n=== Campaign Created Successfully ===");
    console.log("Campaign address:", campaignAddress);
    console.log("Owner (from event):", ownerFromEvent);
    
    // Verify owner from the campaign contract
    const Crowd = await ethers.getContractFactory("CrowdFunding");
    const campaign = Crowd.attach(campaignAddress) as any;
    
    const owner = await campaign.owner();
    const fundingGoalFromContract = await campaign.fundingGoal();
    const state = await campaign.getStateString();
    
    console.log("\n=== Campaign Details ===");
    console.log("Campaign address:", campaignAddress);
    console.log("Owner (from contract):", owner);
    console.log("Funding goal:", ethers.formatUnits(fundingGoalFromContract, 18), "tokens");
    console.log("State:", state);
    
    // Verify ownership
    console.log("\n=== Ownership Verification ===");
    console.log("User address:", user.address);
    console.log("Campaign owner:", owner);
    console.log("Is user the owner?", user.address.toLowerCase() === owner.toLowerCase() ? "✅ YES" : "❌ NO");
    
    if (user.address.toLowerCase() === owner.toLowerCase()) {
      console.log("\n✅ SUCCESS: User is the owner of the campaign!");
    } else {
      console.log("\n❌ ERROR: User is NOT the owner. Factory might be the owner instead.");
      console.log("This means the Factory contract needs to be redeployed with the updated code.");
    }
  } else {
    // Fallback: get latest campaign from factory
    const allCampaigns = await factory.getAllCampaigns();
    if (allCampaigns.length > 0) {
      const campaignAddress = allCampaigns[allCampaigns.length - 1];
      console.log("\nCampaign address (from factory list):", campaignAddress);
      
      const Crowd = await ethers.getContractFactory("CrowdFunding");
      const campaign = Crowd.attach(campaignAddress);
      const owner = await campaign.owner();
      
      console.log("Owner:", owner);
      console.log("Is user the owner?", user.address.toLowerCase() === owner.toLowerCase() ? "✅ YES" : "❌ NO");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
