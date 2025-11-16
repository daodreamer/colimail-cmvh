// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/ICMVHRewardPool.sol";
import "./interfaces/IWACTToken.sol";
import "./CMVHVerifier.sol";

/**
 * @title CMVHRewardPoolV1
 * @author ColiMail Labs (Dao Dreamer)
 * @notice UUPS upgradeable reward pool for CMVH email verification
 * @dev Implements reward creation, claiming, and cancellation with anti-fraud mechanisms
 *
 * Key Features:
 * - UUPS upgradeable pattern
 * - Email hash uniqueness (prevents replay attacks)
 * - Signature verification via CMVHVerifier
 * - Time-locked claiming (prevents front-running)
 * - Protocol and cancellation fees
 * - Batch operations for gas efficiency
 *
 * Security:
 * - ReentrancyGuard on all state-changing functions
 * - Pausable for emergency stops
 * - Owner-controlled parameters
 * - SafeERC20 for token transfers
 */
contract CMVHRewardPoolV1 is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ICMVHRewardPool
{
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice wACT token contract
    IWACTToken public wactToken;

    /// @notice CMVH Verifier contract for signature verification
    CMVHVerifier public verifier;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Minimum reward amount (to prevent spam)
    uint256 public minRewardAmount;

    /// @notice Maximum expiry duration (in seconds)
    uint256 public maxExpiryDuration;

    /// @notice Protocol fee percentage (in basis points, 50 = 0.5%)
    uint256 public protocolFeePercent;

    /// @notice Cancellation fee percentage (in basis points, 100 = 1%)
    uint256 public cancellationFeePercent;

    /// @notice Claim delay (to prevent front-running)
    uint256 public constant CLAIM_DELAY = 1 minutes;

    /// @notice Mapping of reward ID to reward info
    mapping(bytes32 => RewardInfo) public rewards;

    /// @notice Mapping to track used email hashes (prevents replay)
    mapping(bytes32 => bool) public usedEmailHashes;

    /// @notice Mapping of user address to their sent reward IDs
    mapping(address => bytes32[]) private userSentRewards;

    /// @notice Mapping of user address to their received reward IDs
    mapping(address => bytes32[]) private userReceivedRewards;

    /// @notice Mapping of user address to their statistics
    mapping(address => UserStats) public userStats;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param _wactToken wACT token address (0x24De878d1af185A2Bd7Fd45D53180d15d4663F37 on Arbitrum Sepolia)
     * @param _verifier CMVHVerifier contract address
     * @param _feeCollector Fee collector address
     * @param initialOwner Initial owner address
     */
    function initialize(
        address _wactToken,
        address _verifier,
        address _feeCollector,
        address initialOwner
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        if (_wactToken == address(0)) revert InvalidRecipient();
        if (_verifier == address(0)) revert InvalidRecipient();
        if (_feeCollector == address(0)) revert InvalidRecipient();

        wactToken = IWACTToken(_wactToken);
        verifier = CMVHVerifier(_verifier);
        feeCollector = _feeCollector;

        // Default parameters
        minRewardAmount = 0.01 ether; // 0.01 wACT
        maxExpiryDuration = 30 days;
        protocolFeePercent = 50; // 0.5%
        cancellationFeePercent = 100; // 1%
    }

    // ============ Core Functions ============

    /**
     * @notice Create a reward for an email
     * @dev Requires prior approval of wACT tokens
     */
    function createReward(
        address recipient,
        uint256 amount,
        bytes32 emailHash,
        string calldata subject,
        string calldata from,
        string calldata to,
        uint256 expiryDuration
    ) external override whenNotPaused nonReentrant returns (bytes32 rewardId) {
        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount < minRewardAmount) revert InvalidAmount();
        if (expiryDuration == 0 || expiryDuration > maxExpiryDuration) {
            revert InvalidExpiryDuration();
        }
        if (usedEmailHashes[emailHash]) revert EmailHashAlreadyUsed();

        // Verify email hash matches content
        bytes32 computedHash = verifier.hashEmail(subject, from, to);
        if (computedHash != emailHash) revert EmailHashMismatch();

        // Generate unique reward ID
        rewardId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                emailHash,
                block.timestamp,
                block.number
            )
        );

        // Create reward
        uint256 expiryTime = block.timestamp + expiryDuration;
        rewards[rewardId] = RewardInfo({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            timestamp: block.timestamp,
            expiryTime: expiryTime,
            claimed: false,
            emailHash: emailHash
        });

        // Mark email hash as used
        usedEmailHashes[emailHash] = true;

        // Track user rewards
        userSentRewards[msg.sender].push(rewardId);
        userReceivedRewards[recipient].push(rewardId);

        // Update stats
        userStats[msg.sender].totalSent++;
        userStats[msg.sender].totalAmountSent += amount;
        userStats[msg.sender].activeRewards++;
        userStats[recipient].totalReceived++;
        userStats[recipient].totalAmountReceived += amount;
        userStats[recipient].activeRewards++;

        // Transfer wACT from sender to contract
        IERC20(address(wactToken)).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        emit RewardCreated(
            rewardId,
            msg.sender,
            recipient,
            amount,
            emailHash,
            expiryTime
        );
    }

    /**
     * @notice Claim a reward by verifying email signature
     */
    function claimReward(
        bytes32 rewardId,
        bytes32 emailHash,
        bytes calldata signature,
        string calldata subject,
        string calldata from,
        string calldata to
    ) external override whenNotPaused nonReentrant {
        RewardInfo storage reward = rewards[rewardId];

        // Validate reward exists
        if (reward.sender == address(0)) revert RewardNotFound();
        if (reward.claimed) revert RewardAlreadyClaimed();
        if (block.timestamp > reward.expiryTime) revert RewardExpired();

        // Validate caller is recipient
        if (msg.sender != reward.recipient) revert NotRecipient();

        // Validate email hash matches
        if (emailHash != reward.emailHash) revert EmailHashMismatch();

        // Verify claim delay has passed (anti-front-running)
        if (block.timestamp < reward.timestamp + CLAIM_DELAY) {
            revert ClaimDelayNotPassed();
        }

        // Verify email hash matches content
        bytes32 computedHash = verifier.hashEmail(subject, from, to);
        if (computedHash != emailHash) revert EmailHashMismatch();

        // Verify signature via CMVHVerifier
        bool isValid = verifier.verifySignature(
            reward.sender,
            emailHash,
            signature
        );
        if (!isValid) revert InvalidSignature();

        // Mark as claimed
        reward.claimed = true;

        // Update stats
        userStats[reward.sender].activeRewards--;
        userStats[reward.recipient].activeRewards--;

        // Calculate fees
        uint256 fee = (reward.amount * protocolFeePercent) / 10000;
        uint256 netAmount = reward.amount - fee;

        // Transfer tokens
        if (fee > 0) {
            IERC20(address(wactToken)).safeTransfer(feeCollector, fee);
            emit ProtocolFeeCollected(feeCollector, fee);
        }
        IERC20(address(wactToken)).safeTransfer(reward.recipient, netAmount);

        emit RewardClaimed(rewardId, msg.sender, netAmount, fee);
    }

    /**
     * @notice Cancel an expired reward
     */
    function cancelReward(bytes32 rewardId)
        external
        override
        whenNotPaused
        nonReentrant
    {
        RewardInfo storage reward = rewards[rewardId];

        // Validate
        if (reward.sender == address(0)) revert RewardNotFound();
        if (msg.sender != reward.sender) revert NotSender();
        if (reward.claimed) revert RewardAlreadyClaimed();
        if (block.timestamp <= reward.expiryTime) revert RewardNotExpired();

        // Calculate refund
        uint256 cancelFee = (reward.amount * cancellationFeePercent) / 10000;
        uint256 refundAmount = reward.amount - cancelFee;

        // Update stats
        userStats[reward.sender].activeRewards--;
        userStats[reward.recipient].activeRewards--;

        // Delete reward (gas refund)
        delete rewards[rewardId];

        // Transfer tokens
        if (cancelFee > 0) {
            IERC20(address(wactToken)).safeTransfer(feeCollector, cancelFee);
            emit ProtocolFeeCollected(feeCollector, cancelFee);
        }
        IERC20(address(wactToken)).safeTransfer(msg.sender, refundAmount);

        emit RewardCancelled(rewardId, msg.sender, refundAmount, cancelFee);
    }

    // ============ Batch Functions ============

    /**
     * @notice Batch create multiple rewards
     * @dev DEPRECATED: Due to EVM stack depth limitations with string[] calldata parameters,
     *      please use createReward() multiple times instead.
     *      This function is kept for interface compatibility but will revert.
     */
    function createRewardsBatch(
        address[] calldata,
        uint256[] calldata,
        bytes32[] calldata,
        string[] calldata,
        string[] calldata,
        string[] calldata,
        uint256
    ) external pure override returns (bytes32[] memory) {
        revert("Batch operations deprecated - use createReward individually");
    }

    /**
     * @notice Batch claim multiple rewards
     * @dev DEPRECATED: Due to EVM stack depth limitations with string[] calldata parameters,
     *      please use claimReward() multiple times instead.
     *      This function is kept for interface compatibility but will revert.
     */
    function claimRewardsBatch(
        bytes32[] calldata,
        bytes32[] calldata,
        bytes[] calldata,
        string[] calldata,
        string[] calldata,
        string[] calldata
    ) external pure override {
        revert("Batch operations deprecated - use claimReward individually");
    }

    // ============ View Functions ============

    /**
     * @notice Get reward information
     */
    function getRewardInfo(bytes32 rewardId)
        external
        view
        override
        returns (RewardInfo memory)
    {
        return rewards[rewardId];
    }

    /**
     * @notice Get user reward IDs
     */
    function getUserRewards(address user, bool asRecipient)
        external
        view
        override
        returns (bytes32[] memory)
    {
        return asRecipient ? userReceivedRewards[user] : userSentRewards[user];
    }

    /**
     * @notice Get user statistics
     */
    function getUserStats(address user)
        external
        view
        override
        returns (UserStats memory)
    {
        return userStats[user];
    }

    /**
     * @notice Check if reward is claimable
     */
    function isRewardClaimable(bytes32 rewardId)
        external
        view
        override
        returns (bool)
    {
        RewardInfo storage reward = rewards[rewardId];
        return
            reward.sender != address(0) &&
            !reward.claimed &&
            block.timestamp <= reward.expiryTime &&
            block.timestamp >= reward.timestamp + CLAIM_DELAY;
    }

    /**
     * @notice Check if email hash has been used
     */
    function isEmailHashUsed(bytes32 emailHash)
        external
        view
        override
        returns (bool)
    {
        return usedEmailHashes[emailHash];
    }

    /**
     * @notice Get current parameters
     */
    function getParameters()
        external
        view
        override
        returns (
            address,
            address,
            address,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            address(wactToken),
            address(verifier),
            feeCollector,
            minRewardAmount,
            maxExpiryDuration,
            protocolFeePercent,
            cancellationFeePercent,
            CLAIM_DELAY
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Set minimum reward amount
     */
    function setMinRewardAmount(uint256 amount) external override onlyOwner {
        minRewardAmount = amount;
        emit ParameterUpdated("minRewardAmount", amount);
    }

    /**
     * @notice Set maximum expiry duration
     */
    function setMaxExpiryDuration(uint256 duration) external override onlyOwner {
        maxExpiryDuration = duration;
        emit ParameterUpdated("maxExpiryDuration", duration);
    }

    /**
     * @notice Set protocol fee percentage
     */
    function setProtocolFeePercent(uint256 feePercent) external override onlyOwner {
        if (feePercent > 500) revert InvalidAmount(); // Max 5%
        protocolFeePercent = feePercent;
        emit ParameterUpdated("protocolFeePercent", feePercent);
    }

    /**
     * @notice Set cancellation fee percentage
     */
    function setCancellationFeePercent(uint256 feePercent)
        external
        override
        onlyOwner
    {
        if (feePercent > 1000) revert InvalidAmount(); // Max 10%
        cancellationFeePercent = feePercent;
        emit ParameterUpdated("cancellationFeePercent", feePercent);
    }

    /**
     * @notice Set fee collector address
     */
    function setFeeCollector(address collector) external override onlyOwner {
        if (collector == address(0)) revert InvalidRecipient();
        feeCollector = collector;
    }

    /**
     * @notice Pause the contract
     */
    function pause() external override onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external override onlyOwner {
        _unpause();
    }

    // ============ UUPS Upgrade Authorization ============

    /**
     * @notice Authorize contract upgrade (only owner)
     * @dev Required by UUPS pattern
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    // ============ Storage Gap ============

    /**
     * @dev Storage gap for future upgrades
     * Reserves 50 slots for additional state variables in future versions
     */
    uint256[50] private __gap;
}
