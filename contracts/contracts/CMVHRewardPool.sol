// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CMVHVerifier.sol";

/**
 * @title CMVHRewardPool
 * @author ColiMail Labs (Dao Dreamer)
 * @notice UUPS upgradeable reward pool for CMVH email verification
 * @dev Implements reward creation, claiming, and cancellation with anti-fraud mechanisms
 *
 * Key Features:
 * - UUPS upgradeable proxy pattern
 * - Email hash uniqueness (prevents replay attacks)
 * - Signature verification via CMVHVerifier
 * - Time-locked claiming (prevents front-running)
 * - Protocol and cancellation fees
 *
 * Security:
 * - ReentrancyGuard on all state-changing functions
 * - Pausable for emergency stops
 * - Owner-controlled parameters
 * - SafeERC20 for token transfers
 * - UUPS upgrade authorization (owner only)
 */
contract CMVHRewardPool is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct RewardInfo {
        address sender;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        uint256 expiryTime;
        bool claimed;
        bytes32 emailHash;
    }

    struct UserStats {
        uint256 totalSent;
        uint256 totalReceived;
        uint256 totalAmountSent;
        uint256 totalAmountReceived;
        uint256 activeRewards;
    }

    // ============ Events ============

    event RewardCreated(
        bytes32 indexed rewardId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 emailHash,
        uint256 expiryTime
    );

    event RewardClaimed(
        bytes32 indexed rewardId,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );

    event RewardCancelled(
        bytes32 indexed rewardId,
        address indexed sender,
        uint256 refundAmount,
        uint256 fee
    );

    event ProtocolFeeCollected(address indexed recipient, uint256 amount);
    event ParameterUpdated(string param, uint256 newValue);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event Upgraded(address indexed newImplementation);

    // ============ Errors ============

    error InvalidAmount();
    error InvalidRecipient();
    error InvalidExpiryDuration();
    error EmailHashAlreadyUsed();
    error RewardNotFound();
    error RewardAlreadyClaimed();
    error RewardNotExpired();
    error RewardExpired();
    error NotRecipient();
    error NotSender();
    error InvalidSignature();
    error EmailHashMismatch();
    error ClaimDelayNotPassed();

    // ============ State Variables ============

    /// @notice wACT token contract (changed from immutable for upgradeable)
    IERC20 public wactToken;

    /// @notice CMVH Verifier contract for signature verification (changed from immutable)
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

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param _wactToken wACT token address
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
        if (_wactToken == address(0)) revert InvalidRecipient();
        if (_verifier == address(0)) revert InvalidRecipient();
        if (_feeCollector == address(0)) revert InvalidRecipient();

        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        wactToken = IERC20(_wactToken);
        verifier = CMVHVerifier(_verifier);
        feeCollector = _feeCollector;

        // Default parameters
        minRewardAmount = 0.01 ether; // 0.01 wACT
        maxExpiryDuration = 30 days;
        protocolFeePercent = 50; // 0.5%
        cancellationFeePercent = 100; // 1%
    }

    /**
     * @notice Authorize upgrade to new implementation (UUPS pattern)
     * @dev Only the owner can authorize upgrades
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit Upgraded(newImplementation);
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
    ) external whenNotPaused nonReentrant returns (bytes32 rewardId) {
        // Validate inputs
        _validateCreateReward(recipient, amount, expiryDuration, emailHash);

        // Verify email hash matches content
        if (verifier.hashEmail(subject, from, to) != emailHash) revert EmailHashMismatch();

        // Generate unique reward ID
        rewardId = _generateRewardId(recipient, emailHash);

        // Create reward and update state
        _createRewardInternal(rewardId, recipient, amount, expiryDuration, emailHash);

        // Transfer wACT from sender to contract
        wactToken.safeTransferFrom(msg.sender, address(this), amount);

        emit RewardCreated(
            rewardId,
            msg.sender,
            recipient,
            amount,
            emailHash,
            block.timestamp + expiryDuration
        );
    }

    function _validateCreateReward(
        address recipient,
        uint256 amount,
        uint256 expiryDuration,
        bytes32 emailHash
    ) private view {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount < minRewardAmount) revert InvalidAmount();
        // Ensure expiry is long enough to allow claiming (CLAIM_DELAY + 1 hour buffer)
        if (expiryDuration < CLAIM_DELAY + 1 hours || expiryDuration > maxExpiryDuration) {
            revert InvalidExpiryDuration();
        }
        if (usedEmailHashes[emailHash]) revert EmailHashAlreadyUsed();
    }

    function _generateRewardId(
        address recipient,
        bytes32 emailHash
    ) private view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                emailHash,
                block.timestamp,
                block.number
            )
        );
    }

    function _createRewardInternal(
        bytes32 rewardId,
        address recipient,
        uint256 amount,
        uint256 expiryDuration,
        bytes32 emailHash
    ) private {
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

        usedEmailHashes[emailHash] = true;
        userSentRewards[msg.sender].push(rewardId);
        userReceivedRewards[recipient].push(rewardId);

        _updateStatsOnCreate(recipient, amount);
    }

    function _updateStatsOnCreate(address recipient, uint256 amount) private {
        userStats[msg.sender].totalSent++;
        userStats[msg.sender].totalAmountSent += amount;
        userStats[msg.sender].activeRewards++;
        userStats[recipient].totalReceived++;
        userStats[recipient].totalAmountReceived += amount;
        userStats[recipient].activeRewards++;
    }

    /**
     * @notice Claim a reward by verifying email signature
     * @dev Can be called even when paused to allow users to withdraw funds
     */
    function claimReward(
        bytes32 rewardId,
        bytes32 emailHash,
        bytes calldata signature,
        string calldata subject,
        string calldata from,
        string calldata to
    ) external nonReentrant {
        RewardInfo storage reward = rewards[rewardId];

        // Validate reward can be claimed
        _validateClaimReward(reward, emailHash);

        // Verify email hash matches content and signature
        if (verifier.hashEmail(subject, from, to) != emailHash) revert EmailHashMismatch();
        if (!verifier.verifySignature(reward.sender, emailHash, signature)) {
            revert InvalidSignature();
        }

        // Process claim
        _processClaimInternal(rewardId, reward);
    }

    function _validateClaimReward(
        RewardInfo storage reward,
        bytes32 emailHash
    ) private view {
        if (reward.sender == address(0)) revert RewardNotFound();
        if (reward.claimed) revert RewardAlreadyClaimed();
        if (block.timestamp > reward.expiryTime) revert RewardExpired();
        if (msg.sender != reward.recipient) revert NotRecipient();
        if (emailHash != reward.emailHash) revert EmailHashMismatch();
        if (block.timestamp < reward.timestamp + CLAIM_DELAY) {
            revert ClaimDelayNotPassed();
        }
    }

    function _processClaimInternal(
        bytes32 rewardId,
        RewardInfo storage reward
    ) private {
        reward.claimed = true;

        userStats[reward.sender].activeRewards--;
        userStats[reward.recipient].activeRewards--;

        // Cache state variables to save gas
        uint256 _protocolFeePercent = protocolFeePercent;
        uint256 fee = (reward.amount * _protocolFeePercent) / 10000;
        uint256 netAmount = reward.amount - fee;

        // Clear email hash to allow reuse (fixes DoS vulnerability)
        delete usedEmailHashes[reward.emailHash];

        if (fee > 0) {
            wactToken.safeTransfer(feeCollector, fee);
            emit ProtocolFeeCollected(feeCollector, fee);
        }
        wactToken.safeTransfer(reward.recipient, netAmount);

        emit RewardClaimed(rewardId, msg.sender, netAmount, fee);
    }

    /**
     * @notice Cancel an expired reward
     * @dev Can be called even when paused to allow users to withdraw funds
     */
    function cancelReward(bytes32 rewardId) external nonReentrant {
        RewardInfo storage reward = rewards[rewardId];

        // Validate
        if (reward.sender == address(0)) revert RewardNotFound();
        if (msg.sender != reward.sender) revert NotSender();
        if (reward.claimed) revert RewardAlreadyClaimed();
        if (block.timestamp <= reward.expiryTime) revert RewardNotExpired();

        // Process cancellation
        _processCancelInternal(rewardId, reward);
    }

    function _processCancelInternal(
        bytes32 rewardId,
        RewardInfo storage reward
    ) private {
        // Cache state variables to save gas
        uint256 _cancellationFeePercent = cancellationFeePercent;
        uint256 cancelFee = (reward.amount * _cancellationFeePercent) / 10000;
        uint256 refundAmount = reward.amount - cancelFee;

        userStats[reward.sender].activeRewards--;
        userStats[reward.recipient].activeRewards--;

        // Clear email hash to allow reuse (fixes DoS vulnerability)
        delete usedEmailHashes[reward.emailHash];

        delete rewards[rewardId];

        if (cancelFee > 0) {
            wactToken.safeTransfer(feeCollector, cancelFee);
            emit ProtocolFeeCollected(feeCollector, cancelFee);
        }
        wactToken.safeTransfer(msg.sender, refundAmount);

        emit RewardCancelled(rewardId, msg.sender, refundAmount, cancelFee);
    }

    // ============ View Functions ============

    /**
     * @notice Get reward information
     */
    function getRewardInfo(bytes32 rewardId) external view returns (RewardInfo memory) {
        return rewards[rewardId];
    }

    /**
     * @notice Get user reward IDs
     */
    function getUserRewards(address user, bool asRecipient)
        external
        view
        returns (bytes32[] memory)
    {
        return asRecipient ? userReceivedRewards[user] : userSentRewards[user];
    }

    /**
     * @notice Get user statistics
     */
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }

    /**
     * @notice Check if reward is claimable
     */
    function isRewardClaimable(bytes32 rewardId) external view returns (bool) {
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
    function isEmailHashUsed(bytes32 emailHash) external view returns (bool) {
        return usedEmailHashes[emailHash];
    }

    /**
     * @notice Get implementation version (for upgrade tracking)
     * @return Current implementation version
     */
    function getImplementationVersion() external pure returns (string memory) {
        return "1.0.0";
    }

    // ============ Admin Functions ============

    /**
     * @notice Set minimum reward amount
     */
    function setMinRewardAmount(uint256 amount) external onlyOwner {
        minRewardAmount = amount;
        emit ParameterUpdated("minRewardAmount", amount);
    }

    /**
     * @notice Set maximum expiry duration
     */
    function setMaxExpiryDuration(uint256 duration) external onlyOwner {
        maxExpiryDuration = duration;
        emit ParameterUpdated("maxExpiryDuration", duration);
    }

    /**
     * @notice Set protocol fee percentage
     */
    function setProtocolFeePercent(uint256 feePercent) external onlyOwner {
        if (feePercent > 500) revert InvalidAmount(); // Max 5%
        protocolFeePercent = feePercent;
        emit ParameterUpdated("protocolFeePercent", feePercent);
    }

    /**
     * @notice Set cancellation fee percentage
     */
    function setCancellationFeePercent(uint256 feePercent) external onlyOwner {
        if (feePercent > 1000) revert InvalidAmount(); // Max 10%
        cancellationFeePercent = feePercent;
        emit ParameterUpdated("cancellationFeePercent", feePercent);
    }

    /**
     * @notice Set fee collector address
     */
    function setFeeCollector(address collector) external onlyOwner {
        if (collector == address(0)) revert InvalidRecipient();
        address oldCollector = feeCollector;
        feeCollector = collector;
        emit FeeCollectorUpdated(oldCollector, collector);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
