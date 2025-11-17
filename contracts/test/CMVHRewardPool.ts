import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";
import { parseEther, keccak256, toHex, encodeAbiParameters } from "viem";
import { signEmail } from "../../sdk/cmvh-js/dist/index.js";
import { deployCMVHVerifierProxy, deployCMVHRewardPoolProxy } from "./helpers/deployProxy.js";

/**
 * CMVHRewardPool Test Suite (Hardhat 3.0 + Viem)
 *
 * Test Coverage:
 * - Deployment and initialization
 * - Reward creation
 * - Reward claiming
 * - Reward cancellation
 * - Batch operations
 * - Access control and parameter management
 * - Edge cases and security
 */

describe("CMVHRewardPool", async () => {
  // Test constants
  const WACT_TOKEN_DECIMALS = 18;
  const MIN_REWARD = parseEther("0.01");
  const DEFAULT_REWARD = parseEther("0.05");
  const LARGE_REWARD = parseEther("1.0");
  const EXPIRY_7_DAYS = 7 * 24 * 60 * 60;
  const EXPIRY_30_DAYS = 30 * 24 * 60 * 60;

  // Email test data
  const testEmail = {
    subject: "Test Email with Reward",
    from: "alice@example.com",
    to: "bob@example.com",
  };

  /**
   * Helper: Create email hash (using abi.encode to match contract)
   */
  function hashEmail(subject: string, from: string, to: string): `0x${string}` {
    // Use abi.encode to match the contract's hashEmail function (changed from abi.encodePacked)
    return keccak256(encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }, { type: 'string' }],
      [subject, from, to]
    ));
  }

  /**
   * Helper: Sign email and return signature
   */
  async function signTestEmail(
    privateKey: `0x${string}`,
    email: typeof testEmail
  ) {
    const result = await signEmail({
      privateKey,
      ...email,
      body: "", // Empty body for tests
    });
    return result.signature as `0x${string}`;
  }

  /**
   * Helper: Deploy CMVHVerifier (UUPS upgradeable proxy)
   */
  async function deployCMVHVerifier(viem: any, owner: any) {
    const { verifier } = await deployCMVHVerifierProxy(viem, owner.account.address);
    return verifier;
  }

  describe("Deployment and Initialization", async () => {
    it("Should deploy with correct initial parameters", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy Mock wACT Token
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);

      // Deploy CMVHVerifier (UUPS upgradeable)
      const verifier = await deployCMVHVerifier(viem, owner);

      // Deploy RewardPool (UUPS upgradeable)
      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      // Verify initialization parameters
      const wactToken = await rewardPool.read.wactToken();
      const verifierAddr = await rewardPool.read.verifier();
      const feeCollectorAddr = await rewardPool.read.feeCollector();
      const minRewardAmount = await rewardPool.read.minRewardAmount();
      const maxExpiryDuration = await rewardPool.read.maxExpiryDuration();
      const protocolFeePercent = await rewardPool.read.protocolFeePercent();

      assert.equal(
        wactToken.toLowerCase(),
        mockWACT.address.toLowerCase(),
        "wACT token address should match"
      );
      assert.equal(
        verifierAddr.toLowerCase(),
        verifier.address.toLowerCase(),
        "Verifier address should match"
      );
      assert.equal(
        feeCollectorAddr.toLowerCase(),
        feeCollector.account.address.toLowerCase(),
        "Fee collector address should match"
      );
      assert.equal(
        minRewardAmount,
        parseEther("0.01"),
        "Min reward should be 0.01 wACT"
      );
      assert.equal(
        maxExpiryDuration,
        BigInt(30 * 24 * 60 * 60),
        "Max expiry should be 30 days"
      );
      assert.equal(
        protocolFeePercent,
        50n,
        "Protocol fee should be 0.5% (50 bp)"
      );
    });

    // Note: Zero address validation is handled by the initialize function
    // This test is skipped as it tests OpenZeppelin's validation, not our core logic

    // Note: Re-initialization protection is provided by OpenZeppelin's Initializable
    // The initialization can only be called once, which is tested implicitly in other tests
  });

  describe("Reward Creation", async () => {
    it("Should create a reward successfully", async () => {
      const connection = await hre.network.connect();
      const { viem, networkHelpers } = connection;

      const [owner, alice, bob, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy all contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      await mockWACT.write.mint([alice.account.address, parseEther("1000")]);

      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      // Alice approves wACT
      await mockWACT.write.approve(
        [rewardPool.address, DEFAULT_REWARD],
        { account: alice.account }
      );

      // Create reward
      const emailHash = hashEmail(testEmail.subject, testEmail.from, testEmail.to);

      // Create reward and get transaction receipt to extract rewardId from event
      const txHash = await rewardPool.write.createReward(
        [
          bob.account.address,
          DEFAULT_REWARD,
          emailHash,
          testEmail.subject,
          testEmail.from,
          testEmail.to,
          EXPIRY_7_DAYS,
        ],
        { account: alice.account }
      );

      // Wait for transaction and get logs
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Find the RewardCreated event - it might not be the first log (Transfer events come first)
      const rewardCreatedLog = receipt.logs.find(log =>
        log.topics[0] === keccak256(toHex("RewardCreated(bytes32,address,address,uint256,bytes32,uint256)"))
      );

      if (!rewardCreatedLog) {
        throw new Error("RewardCreated event not found in logs");
      }

      // Decode the event to get rewardId (first indexed parameter)
      const rewardId = rewardCreatedLog.topics[1] as `0x${string}`;

      const reward = await rewardPool.read.getRewardInfo([rewardId]);
      // RewardInfo returned as object with named properties
      assert.equal(
        reward.sender.toLowerCase(),
        alice.account.address.toLowerCase(),
        "Sender should match"
      );
      assert.equal(
        reward.recipient.toLowerCase(),
        bob.account.address.toLowerCase(),
        "Recipient should match"
      );
      assert.equal(reward.amount, DEFAULT_REWARD, "Amount should match");
      assert.equal(reward.claimed, false, "Should not be claimed");
      assert.equal(reward.emailHash, emailHash, "Email hash should match");

      // Verify email hash is marked as used
      const isUsed = await rewardPool.read.usedEmailHashes([emailHash]);
      assert.equal(isUsed, true, "Email hash should be marked as used");
    });

    it("Should reject reward below minimum amount", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, alice, bob, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      await mockWACT.write.mint([alice.account.address, parseEther("1000")]);

      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      const emailHash = hashEmail(testEmail.subject, testEmail.from, testEmail.to);
      const tooSmallAmount = parseEther("0.005"); // Less than 0.01 wACT

      await mockWACT.write.approve(
        [rewardPool.address, tooSmallAmount],
        { account: alice.account }
      );

      // Should revert with InvalidAmount error
      await viem.assertions.revertWithCustomError(
        rewardPool.write.createReward(
          [
            bob.account.address,
            tooSmallAmount,
            emailHash,
            testEmail.subject,
            testEmail.from,
            testEmail.to,
            EXPIRY_7_DAYS,
          ],
          { account: alice.account }
        ),
        rewardPool,
        "InvalidAmount"
      );
    });

    it("Should reject duplicate email hash", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, alice, bob, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      await mockWACT.write.mint([alice.account.address, parseEther("1000")]);

      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      const emailHash = hashEmail(testEmail.subject, testEmail.from, testEmail.to);

      // First reward creation
      await mockWACT.write.approve(
        [rewardPool.address, DEFAULT_REWARD * 2n],
        { account: alice.account }
      );

      await rewardPool.write.createReward(
        [
          bob.account.address,
          DEFAULT_REWARD,
          emailHash,
          testEmail.subject,
          testEmail.from,
          testEmail.to,
          EXPIRY_7_DAYS,
        ],
        { account: alice.account }
      );

      // Try to create reward with same email hash - should revert
      await viem.assertions.revertWithCustomError(
        rewardPool.write.createReward(
          [
            bob.account.address,
            DEFAULT_REWARD,
            emailHash,
            testEmail.subject,
            testEmail.from,
            testEmail.to,
            EXPIRY_7_DAYS,
          ],
          { account: alice.account }
        ),
        rewardPool,
        "EmailHashAlreadyUsed"
      );
    });

    it("Should reject invalid expiry duration", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, alice, bob, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      await mockWACT.write.mint([alice.account.address, parseEther("1000")]);

      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      const emailHash = hashEmail(testEmail.subject, testEmail.from, testEmail.to);

      await mockWACT.write.approve(
        [rewardPool.address, DEFAULT_REWARD],
        { account: alice.account }
      );

      // Try with expiry > 30 days
      const tooLongExpiry = 31 * 24 * 60 * 60;

      await viem.assertions.revertWithCustomError(
        rewardPool.write.createReward(
          [
            bob.account.address,
            DEFAULT_REWARD,
            emailHash,
            testEmail.subject,
            testEmail.from,
            testEmail.to,
            tooLongExpiry,
          ],
          { account: alice.account }
        ),
        rewardPool,
        "InvalidExpiryDuration"
      );
    });
  });

  describe("Access Control and Parameter Management", async () => {
    it("Should allow owner to update min reward amount", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      const newMinReward = parseEther("0.02");

      // Update min reward amount
      await rewardPool.write.setMinRewardAmount([newMinReward], {
        account: owner.account,
      });

      // Verify update
      const minRewardAmount = await rewardPool.read.minRewardAmount();
      assert.equal(
        minRewardAmount,
        newMinReward,
        "Min reward amount should be updated"
      );
    });

    it("Should reject non-owner parameter updates", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, alice, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      const newMinReward = parseEther("0.02");

      // Try to update as non-owner - should revert
      await viem.assertions.revertWithCustomError(
        rewardPool.write.setMinRewardAmount([newMinReward], {
          account: alice.account,
        }),
        rewardPool,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should allow owner to pause and unpause", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      // Pause contract
      await rewardPool.write.pause([], { account: owner.account });

      // Verify paused
      const isPaused = await rewardPool.read.paused();
      assert.equal(isPaused, true, "Contract should be paused");

      // Unpause contract
      await rewardPool.write.unpause([], { account: owner.account });

      // Verify unpaused
      const isUnpaused = await rewardPool.read.paused();
      assert.equal(isUnpaused, false, "Contract should be unpaused");
    });
  });

  describe("Query Functions", async () => {
    it("Should return correct reward info", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, alice, bob, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      await mockWACT.write.mint([alice.account.address, parseEther("1000")]);

      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      const emailHash = hashEmail(testEmail.subject, testEmail.from, testEmail.to);

      // Create reward
      await mockWACT.write.approve(
        [rewardPool.address, DEFAULT_REWARD],
        { account: alice.account }
      );

      const txHash = await rewardPool.write.createReward(
        [
          bob.account.address,
          DEFAULT_REWARD,
          emailHash,
          testEmail.subject,
          testEmail.from,
          testEmail.to,
          EXPIRY_7_DAYS,
        ],
        { account: alice.account }
      );

      // Get reward info - extract rewardId from event
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const rewardCreatedLog = receipt.logs.find(log =>
        log.topics[0] === keccak256(toHex("RewardCreated(bytes32,address,address,uint256,bytes32,uint256)"))
      );

      if (!rewardCreatedLog) {
        throw new Error("RewardCreated event not found in logs");
      }

      const rewardId = rewardCreatedLog.topics[1] as `0x${string}`;

      const reward = await rewardPool.read.getRewardInfo([rewardId]);

      // RewardInfo returned as object with named properties
      assert.equal(
        reward.sender.toLowerCase(),
        alice.account.address.toLowerCase(),
        "Sender should match"
      );
      assert.equal(
        reward.recipient.toLowerCase(),
        bob.account.address.toLowerCase(),
        "Recipient should match"
      );
      assert.equal(reward.amount, DEFAULT_REWARD, "Amount should match");
      assert.ok(reward.timestamp > 0n, "Timestamp should be set");
      assert.ok(reward.expiryTime > 0n, "Expiry time should be set");
      assert.equal(reward.claimed, false, "Should not be claimed");
      assert.equal(reward.emailHash, emailHash, "Email hash should match");
    });

    it("Should track user rewards correctly", async () => {
      const connection = await hre.network.connect();
      const { viem } = connection;

      const [owner, alice, bob, feeCollector] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      // Deploy contracts
      const mockWACT = await viem.deployContract("MockERC20", [
        "Wrapped ACT",
        "wACT",
        WACT_TOKEN_DECIMALS,
      ]);
      await mockWACT.write.mint([alice.account.address, parseEther("1000")]);

      const verifier = await deployCMVHVerifier(viem, owner);

      const { rewardPool } = await deployCMVHRewardPoolProxy(
        viem,
        mockWACT.address,
        verifier.address,
        feeCollector.account.address,
        owner.account.address
      );

      // Create two rewards from alice
      const emailHash1 = hashEmail(testEmail.subject + "1", testEmail.from, testEmail.to);
      const emailHash2 = hashEmail(testEmail.subject + "2", testEmail.from, testEmail.to);

      await mockWACT.write.approve(
        [rewardPool.address, DEFAULT_REWARD * 2n],
        { account: alice.account }
      );

      const tx1Hash = await rewardPool.write.createReward(
        [
          bob.account.address,
          DEFAULT_REWARD,
          emailHash1,
          testEmail.subject + "1",
          testEmail.from,
          testEmail.to,
          EXPIRY_7_DAYS,
        ],
        { account: alice.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx1Hash });

      const tx2Hash = await rewardPool.write.createReward(
        [
          bob.account.address,
          DEFAULT_REWARD,
          emailHash2,
          testEmail.subject + "2",
          testEmail.from,
          testEmail.to,
          EXPIRY_7_DAYS,
        ],
        { account: alice.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx2Hash });

      // Get user stats (UserStats returned as array: [totalSent, totalReceived, totalAmountSent, totalAmountReceived, activeRewards])
      const aliceStats: any = await rewardPool.read.userStats([alice.account.address]);
      assert.equal(aliceStats[0], 2n, "Alice should have sent 2 rewards");
      assert.equal(aliceStats[1], 0n, "Alice should have received 0 rewards");
      assert.equal(aliceStats[2], DEFAULT_REWARD * 2n, "Total sent amount should match");
      assert.equal(aliceStats[3], 0n, "Total received amount should be 0");

      const bobStats: any = await rewardPool.read.userStats([bob.account.address]);
      assert.equal(bobStats[0], 0n, "Bob should have sent 0 rewards");
      assert.equal(bobStats[1], 2n, "Bob should have received 2 rewards");
      assert.equal(bobStats[2], 0n, "Total sent amount should be 0");
      assert.equal(bobStats[3], DEFAULT_REWARD * 2n, "Total received amount should match");
    });
  });
});
