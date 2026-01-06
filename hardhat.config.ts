import { defineConfig } from "hardhat/config";

import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";

export default defineConfig({
  solidity: "0.8.28",
  plugins: [hardhatEthers, hardhatMocha, hardhatChaiMatchers],
});
