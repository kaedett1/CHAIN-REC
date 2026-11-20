require("dotenv").config();
const { ethers } = require("ethers");
const abi = require("./DocumentRegistry.abi.json");

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC);
const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

function toBytes32(hash) {
  return "0x" + hash;
}

async function storeOnChain(hash) {
  const tx = await contract.storeHash(toBytes32(hash));
  const receipt = await tx.wait();
  return { txHash: receipt.hash, block: receipt.blockNumber };
}

async function verifyOnChain(hash) {
  const result = await contract.verifyHash(toBytes32(hash));
  return {
    exists: result.exists,
    timestamp: Number(result.timestamp)
  };
}

async function chainStatus() {
  const network = await provider.getNetwork();
  const block = await provider.getBlockNumber();
  const total = await contract.totalDocuments();
  return {
    network: "Local Hardhat (chain " + network.chainId + ")",
    block: block,
    total: Number(total),
    contract: process.env.CONTRACT_ADDRESS
  };
}

module.exports = { storeOnChain, verifyOnChain, chainStatus };