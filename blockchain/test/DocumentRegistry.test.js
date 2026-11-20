const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentRegistry", function () {
  let registry, owner, stranger;


  const hashA = ethers.sha256(ethers.toUtf8Bytes("transcript of juan"));
  const hashB = ethers.sha256(ethers.toUtf8Bytes("diploma of maria"));


  beforeEach(async function () {
    [owner, stranger] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("DocumentRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  it("sets the deployer as the owner", async function () {
    expect(await registry.owner()).to.equal(owner.address);
  });

  it("stores a hash and verifies it as existing", async function () {
    await registry.storeHash(hashA);

    const result = await registry.verifyHash(hashA);
    expect(result.exists).to.equal(true);
    expect(result.timestamp).to.be.greaterThan(0);
    expect(result.registeredBy).to.equal(owner.address);
  });

  it("reports an unregistered hash as not existing", async function () {
    const result = await registry.verifyHash(hashB);
    expect(result.exists).to.equal(false);
  });

  it("treats a changed document as a different hash (tamper detection)", async function () {
    await registry.storeHash(hashA);

    const tampered = ethers.sha256(ethers.toUtf8Bytes("transcript of juan EDITED"));
    const result = await registry.verifyHash(tampered);
    expect(result.exists).to.equal(false);
  });

  it("rejects registering the same hash twice", async function () {
    await registry.storeHash(hashA);
    await expect(registry.storeHash(hashA)).to.be.revertedWith(
      "Document already registered"
    );
  });

  it("rejects registration from anyone except the owner", async function () {
    await expect(
      registry.connect(stranger).storeHash(hashA)
    ).to.be.revertedWith("Only the owner can register documents");
  });

  it("counts documents and emits an event", async function () {
    await expect(registry.storeHash(hashA)).to.emit(registry, "DocumentRegistered");
    await registry.storeHash(hashB);
    expect(await registry.totalDocuments()).to.equal(2);
  });
});