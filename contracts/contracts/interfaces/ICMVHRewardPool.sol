// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ICMVHRewardPool
 * @author ColiMail Labs (Dao Dreamer)
 * @notice Interface for CMVH Reward Pool contract
 * @dev Defines all external functions and events for the reward pool system
 */
interface ICMVHRewardPool {
    // ============ Structs ============

    /**
     * @notice Information about a reward
     * @param sender Address of the reward creator
     * @param recipient Address of the intended recipient
     * @param amount Amount of wACT tokens (in wei)
     * @param timestamp Creation timestamp
     * @param expiryTime Expiry timestamp (after which sender can cancel)
     * @param claimed Whether the reward has been claimed
     * @param emailHash Unique hash of the email (prevents replay)
     */
    struct RewardInfo {
        address sender;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        uint256 expiryTime;
        bool claimed;
        bytes32 emailHash;
    }

    /**
     * @notice User statistics for tracking rewards
     * @param totalSent Total number of rewards sent
     * @param totalReceived Total number of rewards received
     * @param totalAmountSent Total wACT amount sent
     * @param totalAmountReceived Total wACT amount received
     * @param activeRewards Number of currently active rewards
     */
    struct UserStats {
        uint256 totalSent;
        uint256 totalReceived;
        uint256 totalAmountSent;
        uint256 totalAmountReceived;
        uint256 activeRewards;
    }

    // ============ Events ============

    /**
     * @notice Emitted when a reward is created
     * @param rewardId Unique identifier for the reward
     * @param sender Address of the reward creator
     * @param recipient Address of the intended recipient
     * @param amount Amount of wACT tokens
     * @param emailHash Hash of the email
     * @param expiryTime When the reward expires
     */
    event RewardCreated(
        bytes32 indexed rewardId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 emailHash,
        uint256 expiryTime
    );

    /**
     * @notice Emitted when a reward is claimed
     * @param rewardId Reward identifier
     * @param recipient Address that claimed the reward
     * @param amount Net amount received (after fees)
     * @param fee Protocol fee deducted
     */
    event RewardClaimed(
        bytes32 indexed rewardId,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );

    /**
     * @notice Emitted when a reward is cancelled
     * @param rewardId Reward identifier
     * @param sender Address of the reward creator
     * @param refundAmount Amount refunded (after cancellation fee)
     * @param fee Cancellation fee deducted
     */
    event RewardCancelled(
        bytes32 indexed rewardId,
        address indexed sender,
        uint256 refundAmount,
        uint256 fee
    );

    /**
     * @notice Emitted when protocol fee is collected
     * @param recipient Fee collector address
     * @param amount Fee amount
     */
    event ProtocolFeeCollected(address indexed recipient, uint256 amount);

    /**
     * @notice Emitted when parameters are updated
     * @param param Parameter name
     * @param newValue New value
     */
    event ParameterUpdated(string param, uint256 newValue);

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
    error ArrayLengthMismatch();

    // ============ Core Functions ============

    /**
     * @notice Create a new reward for an email
     * @param recipient Address of the email recipient
     * @param amount Amount of wACT to reward (must approve first)
     * @param emailHash Unique hash of the email content
     * @param subject Email subject
     * @param from Email from address
     * @param to Email to address
     * @param expiryDuration Duration until expiry (in seconds)
     * @return rewardId Unique identifier for the created reward
     */
    function createReward(
        address recipient,
        uint256 amount,
        bytes32 emailHash,
        string calldata subject,
        string calldata from,
        string calldata to,
        uint256 expiryDuration
    ) external returns (bytes32 rewardId);

    /**
     * @notice Claim a reward by verifying the email signature
     * @param rewardId Reward identifier
     * @param emailHash Email hash (must match reward)
     * @param signature CMVH signature from sender
     * @param subject Email subject
     * @param from Email from address
     * @param to Email to address
     */
    function claimReward(
        bytes32 rewardId,
        bytes32 emailHash,
        bytes calldata signature,
        string calldata subject,
        string calldata from,
        string calldata to
    ) external;

    /**
     * @notice Cancel an expired reward and get refund
     * @param rewardId Reward identifier
     */
    function cancelReward(bytes32 rewardId) external;

    /**
     * @notice Batch create multiple rewards
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     * @param emailHashes Array of email hashes
     * @param subjects Array of email subjects
     * @param froms Array of email from addresses
     * @param tos Array of email to addresses
     * @param expiryDuration Expiry duration for all rewards
     * @return rewardIds Array of created reward IDs
     */
    function createRewardsBatch(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata emailHashes,
        string[] calldata subjects,
        string[] calldata froms,
        string[] calldata tos,
        uint256 expiryDuration
    ) external returns (bytes32[] memory rewardIds);

    /**
     * @notice Batch claim multiple rewards
     * @param rewardIds Array of reward IDs
     * @param emailHashes Array of email hashes
     * @param signatures Array of CMVH signatures
     * @param subjects Array of email subjects
     * @param froms Array of email from addresses
     * @param tos Array of email to addresses
     */
    function claimRewardsBatch(
        bytes32[] calldata rewardIds,
        bytes32[] calldata emailHashes,
        bytes[] calldata signatures,
        string[] calldata subjects,
        string[] calldata froms,
        string[] calldata tos
    ) external;

    // ============ View Functions ============

    /**
     * @notice Get reward information
     * @param rewardId Reward identifier
     * @return Reward information struct
     */
    function getRewardInfo(bytes32 rewardId)
        external
        view
        returns (RewardInfo memory);

    /**
     * @notice Get all reward IDs for a user
     * @param user User address
     * @param asRecipient True to get rewards as recipient, false for sender
     * @return Array of reward IDs
     */
    function getUserRewards(address user, bool asRecipient)
        external
        view
        returns (bytes32[] memory);

    /**
     * @notice Get user statistics
     * @param user User address
     * @return User statistics struct
     */
    function getUserStats(address user) external view returns (UserStats memory);

    /**
     * @notice Check if a reward is claimable
     * @param rewardId Reward identifier
     * @return True if claimable
     */
    function isRewardClaimable(bytes32 rewardId) external view returns (bool);

    /**
     * @notice Check if an email hash has been used
     * @param emailHash Email hash to check
     * @return True if used
     */
    function isEmailHashUsed(bytes32 emailHash) external view returns (bool);

    // ============ Admin Functions ============

    /**
     * @notice Set minimum reward amount
     * @param amount New minimum amount
     */
    function setMinRewardAmount(uint256 amount) external;

    /**
     * @notice Set maximum expiry duration
     * @param duration New maximum duration (in seconds)
     */
    function setMaxExpiryDuration(uint256 duration) external;

    /**
     * @notice Set protocol fee percentage
     * @param feePercent New fee percentage (in basis points, e.g., 50 = 0.5%)
     */
    function setProtocolFeePercent(uint256 feePercent) external;

    /**
     * @notice Set cancellation fee percentage
     * @param feePercent New fee percentage (in basis points)
     */
    function setCancellationFeePercent(uint256 feePercent) external;

    /**
     * @notice Set fee collector address
     * @param collector New fee collector address
     */
    function setFeeCollector(address collector) external;

    /**
     * @notice Pause the contract
     */
    function pause() external;

    /**
     * @notice Unpause the contract
     */
    function unpause() external;

    /**
     * @notice Get current parameters
     * @return wactToken wACT token address
     * @return verifier CMVHVerifier contract address
     * @return feeCollector Fee collector address
     * @return minRewardAmount Minimum reward amount
     * @return maxExpiryDuration Maximum expiry duration
     * @return protocolFeePercent Protocol fee percentage (basis points)
     * @return cancellationFeePercent Cancellation fee percentage (basis points)
     * @return claimDelay Claim delay in seconds
     */
    function getParameters()
        external
        view
        returns (
            address wactToken,
            address verifier,
            address feeCollector,
            uint256 minRewardAmount,
            uint256 maxExpiryDuration,
            uint256 protocolFeePercent,
            uint256 cancellationFeePercent,
            uint256 claimDelay
        );
}
