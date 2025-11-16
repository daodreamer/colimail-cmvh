# CMVH Phase 4 - 奖励池系统设计方案

**版本:** 1.0.0
**状态:** 📋 设计阶段
**日期:** 2025-11-16
**作者:** ColiMail Labs

---

## 📋 目录

1. [概述](#概述)
2. [智能合约架构](#智能合约架构)
3. [经济模型设计](#经济模型设计)
4. [防作弊机制](#防作弊机制)
5. [客户端集成流程](#客户端集成流程)
6. [开发计划](#开发计划)
7. [风险评估](#风险评估)

---

## 概述

### 目标

Phase 4 的核心目标是实现一个完整的**链上奖励池系统**，允许：
- 发送者在邮件中承诺奖励（wACT 代币）
- 接收者通过验证签名来领取奖励
- 防止重放攻击、双花攻击等恶意行为
- 支持批量奖励管理和高效的 Gas 使用

### 核心功能

✅ **奖励池管理**
- 发送者质押 wACT 到奖励池合约
- 接收者验证邮件签名后领取奖励
- 支持奖励过期和退回机制

✅ **防作弊机制**
- 邮件哈希唯一性验证（防止重放）
- Nonce 机制（防止签名复用）
- 时间锁（防止抢跑攻击）
- 领取地址验证（仅收件人可领取）

✅ **Gas 优化**
- 批量操作支持
- 存储优化（packed storage）
- 事件索引优化

✅ **可升级性**
- UUPS 代理模式
- 紧急暂停机制
- 管理员权限控制

---

## 智能合约架构

### 1. 合约结构概览

```
contracts/contracts/
├── CMVHRewardPool.sol          # 主奖励池合约（UUPS 可升级）
├── CMVHRewardPoolV1.sol        # V1 实现
├── interfaces/
│   ├── ICMVHRewardPool.sol     # 奖励池接口
│   └── IWACTToken.sol          # wACT 代币接口（ERC20）
├── libraries/
│   ├── RewardPoolStorage.sol   # 存储布局库
│   └── RewardPoolErrors.sol    # 自定义错误
└── mocks/
    └── MockWACTToken.sol       # 测试用 wACT 模拟代币
```

### 2. CMVHRewardPool 核心功能

#### 2.1 数据结构

```solidity
// 奖励信息结构
struct RewardInfo {
    address sender;          // 发送者地址
    address recipient;       // 接收者地址（邮件中的 to 字段对应）
    uint256 amount;          // 奖励金额（wACT）
    uint256 timestamp;       // 创建时间
    uint256 expiryTime;      // 过期时间
    bool claimed;            // 是否已领取
    bytes32 emailHash;       // 邮件哈希（唯一标识）
}

// 用户统计信息
struct UserStats {
    uint256 totalSent;       // 总发送奖励数量
    uint256 totalReceived;   // 总接收奖励数量
    uint256 activeRewards;   // 当前活跃奖励数量
}
```

#### 2.2 核心函数

**发送者功能：**
```solidity
// 创建奖励（需要事先 approve wACT）
function createReward(
    address recipient,
    uint256 amount,
    bytes32 emailHash,
    string calldata subject,
    string calldata from,
    string calldata to,
    uint256 expiryDuration
) external returns (bytes32 rewardId);

// 批量创建奖励（节省 Gas）
function createRewardsBatch(
    address[] calldata recipients,
    uint256[] calldata amounts,
    bytes32[] calldata emailHashes,
    string[] calldata subjects,
    string[] calldata froms,
    string[] calldata tos,
    uint256 expiryDuration
) external returns (bytes32[] memory rewardIds);

// 取消未领取的奖励（退回代币）
function cancelReward(bytes32 rewardId) external;
```

**接收者功能：**
```solidity
// 领取奖励（需要验证邮件签名）
function claimReward(
    bytes32 rewardId,
    bytes32 emailHash,
    bytes calldata signature,
    string calldata subject,
    string calldata from,
    string calldata to
) external;

// 批量领取奖励
function claimRewardsBatch(
    bytes32[] calldata rewardIds,
    bytes32[] calldata emailHashes,
    bytes[] calldata signatures,
    string[] calldata subjects,
    string[] calldata froms,
    string[] calldata tos
) external;
```

**查询功能：**
```solidity
// 获取奖励信息
function getRewardInfo(bytes32 rewardId) external view returns (RewardInfo memory);

// 查询用户的所有奖励
function getUserRewards(address user, bool asRecipient) external view returns (bytes32[] memory);

// 获取用户统计
function getUserStats(address user) external view returns (UserStats memory);

// 检查奖励是否可领取
function isRewardClaimable(bytes32 rewardId) external view returns (bool);
```

**管理员功能：**
```solidity
// 暂停/恢复合约
function pause() external onlyOwner;
function unpause() external onlyOwner;

// 设置参数
function setMinRewardAmount(uint256 amount) external onlyOwner;
function setMaxExpiryDuration(uint256 duration) external onlyOwner;
function setProtocolFee(uint256 feePercent) external onlyOwner;

// 紧急提取（仅用于合约升级或紧急情况）
function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner;
```

#### 2.3 关键事件

```solidity
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
    uint256 timestamp
);

event RewardCancelled(
    bytes32 indexed rewardId,
    address indexed sender,
    uint256 refundAmount
);

event ProtocolFeeCollected(
    address indexed sender,
    uint256 amount
);
```

### 3. UUPS 代理模式实现

#### 3.1 代理合约结构

```solidity
// 代理合约（部署一次，永久地址）
contract CMVHRewardPoolProxy is ERC1967Proxy {
    constructor(
        address implementation,
        bytes memory _data
    ) ERC1967Proxy(implementation, _data) {}
}

// 实现合约 V1（可升级）
contract CMVHRewardPoolV1 is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // 存储变量（遵循 gap pattern）
    IERC20 public wactToken;
    ICMVHVerifier public verifier;

    mapping(bytes32 => RewardInfo) public rewards;
    mapping(address => UserStats) public userStats;
    mapping(bytes32 => bool) public usedEmailHashes;

    uint256 public minRewardAmount;
    uint256 public maxExpiryDuration;
    uint256 public protocolFeePercent; // 基点 (1% = 100)
    address public feeCollector;

    // 预留存储空间（用于未来升级）
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _wactToken,
        address _verifier,
        address _feeCollector
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        wactToken = IERC20(_wactToken);
        verifier = ICMVHVerifier(_verifier);
        feeCollector = _feeCollector;

        minRewardAmount = 0.01 ether; // 0.01 wACT
        maxExpiryDuration = 30 days;
        protocolFeePercent = 50; // 0.5%
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    // ... 业务逻辑实现
}
```

#### 3.2 升级流程

```solidity
// 部署新版本实现
CMVHRewardPoolV2 newImpl = new CMVHRewardPoolV2();

// 调用代理合约的 upgradeTo
CMVHRewardPoolProxy(proxyAddress).upgradeTo(address(newImpl));

// 如需执行初始化（V2 新增功能）
CMVHRewardPoolProxy(proxyAddress).upgradeToAndCall(
    address(newImpl),
    abi.encodeWithSignature("initializeV2()")
);
```

### 4. wACT 代币集成

#### 4.1 代币接口

```solidity
// wACT 代币接口（标准 ERC20）
interface IWACTToken is IERC20 {
    function decimals() external view returns (uint8);
}
```

#### 4.2 代币交互流程

```
用户端：
1. approve(rewardPool, amount) - 授权代币转移
2. createReward(...)           - 创建奖励（transferFrom）

接收端：
3. claimReward(...)            - 领取奖励（transfer）
```

#### 4.3 安全考虑

- 使用 OpenZeppelin 的 `SafeERC20` 库
- 检查代币余额和授权额度
- 使用 ReentrancyGuard 防止重入攻击
- 验证 transfer/transferFrom 返回值

---

## 经济模型设计

### 1. 奖励参数

| 参数 | 初始值 | 范围 | 说明 |
|------|--------|------|------|
| 最小奖励金额 | 0.01 wACT | 0.001 - 1 wACT | 防止垃圾邮件攻击 |
| 最大过期时间 | 30 天 | 1 - 90 天 | 平衡灵活性和资金锁定 |
| 协议手续费 | 0.5% | 0 - 5% | 可持续发展基金 |
| 紧急取消费 | 1% | 0 - 10% | 防止滥用取消功能 |

### 2. Gas 成本分析

基于 Arbitrum Sepolia 测试网数据：

| 操作 | 预估 Gas | Gas 价格 | 成本（USD） |
|------|----------|----------|-------------|
| 创建单个奖励 | ~80,000 | 0.1 gwei | $0.02 |
| 批量创建（10个） | ~450,000 | 0.1 gwei | $0.09 |
| 领取奖励 | ~70,000 | 0.1 gwei | $0.015 |
| 取消奖励 | ~50,000 | 0.1 gwei | $0.01 |

**优化策略：**
- 批量操作可节省 40% Gas
- 使用 packed storage 减少存储成本
- 事件索引优化查询成本

### 3. 攻击成本评估

#### 3.1 重放攻击

**防御机制：**
- 邮件哈希唯一性检查（`usedEmailHashes` mapping）
- 每个邮件只能创建一次奖励

**攻击成本：**
- 无法重放（技术上不可行）

#### 3.2 垃圾邮件攻击

**防御机制：**
- 最小奖励金额限制（0.01 wACT）
- 协议手续费（0.5%）

**攻击成本：**
- 发送 1000 封垃圾邮件 = 1000 × 0.01 = 10 wACT + Gas 费
- 预计总成本：~15 wACT（约 $150+ USD）

#### 3.3 抢跑攻击（Front-running）

**防御机制：**
- 接收者地址在创建时锁定
- 签名验证确保只有真实接收者能领取

**攻击成本：**
- 技术上不可行（签名验证失败）

### 4. 代币流动性

**初期阶段（测试网）：**
- 使用模拟 wACT 代币（无实际价值）
- 水龙头提供测试代币

**主网阶段：**
- 集成真实 wACT 代币
- 建立流动性池（Uniswap V3 on Arbitrum）
- 初始流动性：10,000 wACT + 5 ETH

---

## 防作弊机制

### 1. 邮件唯一性验证

```solidity
// 防止同一邮件创建多个奖励
modifier uniqueEmail(bytes32 emailHash) {
    require(!usedEmailHashes[emailHash], "Email already used");
    _;
    usedEmailHashes[emailHash] = true;
}

function createReward(...) external uniqueEmail(emailHash) {
    // ...
}
```

### 2. 签名验证流程

```solidity
function claimReward(
    bytes32 rewardId,
    bytes32 emailHash,
    bytes calldata signature,
    string calldata subject,
    string calldata from,
    string calldata to
) external nonReentrant whenNotPaused {
    RewardInfo storage reward = rewards[rewardId];

    // 1. 验证奖励存在且未领取
    require(!reward.claimed, "Already claimed");
    require(block.timestamp <= reward.expiryTime, "Reward expired");

    // 2. 验证调用者是接收者
    require(msg.sender == reward.recipient, "Not the recipient");

    // 3. 验证邮件哈希匹配
    require(emailHash == reward.emailHash, "Email hash mismatch");

    // 4. 验证签名（通过 CMVHVerifier）
    bytes32 computedHash = verifier.hashEmail(subject, from, to);
    require(computedHash == emailHash, "Hash mismatch");

    bool isValid = verifier.verifySignature(
        reward.sender,
        emailHash,
        signature
    );
    require(isValid, "Invalid signature");

    // 5. 标记为已领取并转账
    reward.claimed = true;

    // 6. 扣除协议费并转账
    uint256 fee = (reward.amount * protocolFeePercent) / 10000;
    uint256 netAmount = reward.amount - fee;

    wactToken.safeTransfer(reward.recipient, netAmount);
    if (fee > 0) {
        wactToken.safeTransfer(feeCollector, fee);
    }

    emit RewardClaimed(rewardId, msg.sender, netAmount, block.timestamp);
}
```

### 3. 时间锁机制

```solidity
// 防止抢跑攻击：奖励创建后有短暂延迟才能领取
uint256 public constant CLAIM_DELAY = 1 minutes;

modifier canClaim(bytes32 rewardId) {
    RewardInfo storage reward = rewards[rewardId];
    require(
        block.timestamp >= reward.timestamp + CLAIM_DELAY,
        "Claim delay not passed"
    );
    _;
}
```

### 4. 过期机制

```solidity
// 过期后发送者可取消并退款
function cancelReward(bytes32 rewardId) external nonReentrant {
    RewardInfo storage reward = rewards[rewardId];

    require(msg.sender == reward.sender, "Not the sender");
    require(!reward.claimed, "Already claimed");
    require(
        block.timestamp > reward.expiryTime,
        "Not expired yet"
    );

    // 扣除取消费（防止滥用）
    uint256 cancelFee = (reward.amount * 100) / 10000; // 1%
    uint256 refundAmount = reward.amount - cancelFee;

    // 删除奖励（释放存储空间）
    delete rewards[rewardId];

    wactToken.safeTransfer(msg.sender, refundAmount);
    if (cancelFee > 0) {
        wactToken.safeTransfer(feeCollector, cancelFee);
    }

    emit RewardCancelled(rewardId, msg.sender, refundAmount);
}
```

### 5. 紧急暂停

```solidity
// OpenZeppelin Pausable 集成
function pause() external onlyOwner {
    _pause();
}

function unpause() external onlyOwner {
    _unpause();
}

// 所有关键函数都使用 whenNotPaused modifier
function createReward(...) external whenNotPaused { ... }
function claimReward(...) external whenNotPaused { ... }
```

---

## 客户端集成流程

### 1. 架构概览

```
ColiMail Client (Tauri + SvelteKit)
├── 后端 (Rust)
│   ├── cmvh/wallet/
│   │   ├── mod.rs                 # 钱包模块入口
│   │   ├── provider.rs            # RPC Provider 管理
│   │   ├── rewards.rs             # 奖励池交互
│   │   └── walletconnect.rs       # WalletConnect 集成
│   └── commands/
│       ├── create_reward.rs       # 创建奖励命令
│       ├── claim_reward.rs        # 领取奖励命令
│       └── query_rewards.rs       # 查询奖励命令
│
└── 前端 (SvelteKit + TypeScript)
    ├── lib/wallet/
    │   ├── types.ts               # 钱包类型定义
    │   ├── rewardPool.ts          # 奖励池客户端（viem）
    │   ├── walletConnect.ts       # WalletConnect 客户端
    │   └── tokenApproval.ts       # 代币授权逻辑
    │
    └── routes/
        ├── compose/               # 撰写邮件（带奖励）
        │   └── RewardPanel.svelte # 奖励设置面板
        ├── inbox/                 # 收件箱
        │   └── RewardBadge.svelte # 奖励徽章
        └── rewards/               # 奖励管理页
            ├── MyRewards.svelte   # 我的奖励
            └── ClaimModal.svelte  # 领取奖励弹窗
```

### 2. 详细开发流程

#### 2.1 后端模块（Rust/Tauri）

**文件：`src-tauri/src/cmvh/wallet/mod.rs`**

```rust
pub mod provider;
pub mod rewards;
pub mod walletconnect;

pub use provider::ProviderManager;
pub use rewards::RewardPoolClient;
pub use walletconnect::WalletConnectManager;
```

**文件：`src-tauri/src/cmvh/wallet/provider.rs`**

```rust
use ethers::providers::{Http, Provider, Middleware};
use ethers::types::{Address, U256};

pub struct ProviderManager {
    provider: Provider<Http>,
    chain_id: u64,
}

impl ProviderManager {
    pub async fn new(rpc_url: String, chain_id: u64) -> Result<Self, Box<dyn std::error::Error>> {
        let provider = Provider::<Http>::try_from(rpc_url)?;
        Ok(Self { provider, chain_id })
    }

    pub async fn get_balance(&self, address: Address) -> Result<U256, Box<dyn std::error::Error>> {
        Ok(self.provider.get_balance(address, None).await?)
    }

    pub fn get_provider(&self) -> &Provider<Http> {
        &self.provider
    }
}
```

**文件：`src-tauri/src/cmvh/wallet/rewards.rs`**

```rust
use ethers::prelude::*;
use ethers::contract::abigen;

// 生成合约 ABI 绑定
abigen!(
    CMVHRewardPool,
    "./abi/CMVHRewardPool.json",
    event_derives(serde::Deserialize, serde::Serialize)
);

pub struct RewardPoolClient {
    contract: CMVHRewardPool<Provider<Http>>,
    provider: Provider<Http>,
}

impl RewardPoolClient {
    pub fn new(
        contract_address: Address,
        provider: Provider<Http>,
    ) -> Self {
        let contract = CMVHRewardPool::new(contract_address, Arc::new(provider.clone()));
        Self { contract, provider }
    }

    /// 创建奖励
    pub async fn create_reward(
        &self,
        wallet: &Wallet<SigningKey>,
        recipient: Address,
        amount: U256,
        email_hash: [u8; 32],
        subject: String,
        from: String,
        to: String,
        expiry_duration: u64,
    ) -> Result<TransactionReceipt, Box<dyn std::error::Error>> {
        let client = SignerMiddleware::new(self.provider.clone(), wallet.clone());
        let contract = CMVHRewardPool::new(self.contract.address(), Arc::new(client));

        let tx = contract
            .create_reward(
                recipient,
                amount,
                email_hash,
                subject,
                from,
                to,
                U256::from(expiry_duration),
            )
            .send()
            .await?;

        Ok(tx.await?.ok_or("Transaction failed")?)
    }

    /// 领取奖励
    pub async fn claim_reward(
        &self,
        wallet: &Wallet<SigningKey>,
        reward_id: [u8; 32],
        email_hash: [u8; 32],
        signature: Bytes,
        subject: String,
        from: String,
        to: String,
    ) -> Result<TransactionReceipt, Box<dyn std::error::Error>> {
        let client = SignerMiddleware::new(self.provider.clone(), wallet.clone());
        let contract = CMVHRewardPool::new(self.contract.address(), Arc::new(client));

        let tx = contract
            .claim_reward(
                reward_id,
                email_hash,
                signature,
                subject,
                from,
                to,
            )
            .send()
            .await?;

        Ok(tx.await?.ok_or("Transaction failed")?)
    }

    /// 查询用户奖励
    pub async fn get_user_rewards(
        &self,
        user: Address,
        as_recipient: bool,
    ) -> Result<Vec<[u8; 32]>, Box<dyn std::error::Error>> {
        Ok(self.contract
            .get_user_rewards(user, as_recipient)
            .call()
            .await?)
    }

    /// 获取奖励信息
    pub async fn get_reward_info(
        &self,
        reward_id: [u8; 32],
    ) -> Result<RewardInfo, Box<dyn std::error::Error>> {
        Ok(self.contract
            .get_reward_info(reward_id)
            .call()
            .await?)
    }
}
```

**文件：`src-tauri/src/commands/create_reward.rs`**

```rust
use tauri::State;
use crate::cmvh::wallet::{RewardPoolClient, ProviderManager};

#[tauri::command]
pub async fn create_email_reward(
    recipient: String,
    amount_wact: String,
    subject: String,
    from: String,
    to: String,
    expiry_days: u64,
    reward_pool: State<'_, RewardPoolClient>,
    provider: State<'_, ProviderManager>,
) -> Result<String, String> {
    // 1. 解析参数
    let recipient_addr: Address = recipient.parse()
        .map_err(|e| format!("Invalid recipient address: {}", e))?;

    let amount: U256 = ethers::utils::parse_ether(amount_wact)
        .map_err(|e| format!("Invalid amount: {}", e))?;

    // 2. 计算邮件哈希
    let email_hash = compute_email_hash(&subject, &from, &to);

    // 3. 获取钱包（从 Tauri 安全存储）
    let wallet = get_wallet_from_storage()
        .await
        .map_err(|e| format!("Failed to get wallet: {}", e))?;

    // 4. 检查 wACT 余额和授权
    check_token_allowance(&wallet, amount, &reward_pool)
        .await
        .map_err(|e| format!("Insufficient allowance: {}", e))?;

    // 5. 创建奖励
    let receipt = reward_pool
        .create_reward(
            &wallet,
            recipient_addr,
            amount,
            email_hash,
            subject,
            from,
            to,
            expiry_days * 86400, // 转换为秒
        )
        .await
        .map_err(|e| format!("Failed to create reward: {}", e))?;

    // 6. 返回交易哈希
    Ok(format!("0x{:x}", receipt.transaction_hash))
}
```

#### 2.2 前端模块（SvelteKit + TypeScript）

**文件：`src/lib/wallet/types.ts`**

```typescript
export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  balance: bigint | null;
}

export interface RewardInfo {
  rewardId: string;
  sender: string;
  recipient: string;
  amount: bigint;
  timestamp: number;
  expiryTime: number;
  claimed: boolean;
  emailHash: string;
}

export interface CreateRewardParams {
  recipient: string;
  amountWACT: string;
  subject: string;
  from: string;
  to: string;
  expiryDays: number;
}

export interface ClaimRewardParams {
  rewardId: string;
  emailHash: string;
  signature: string;
  subject: string;
  from: string;
  to: string;
}
```

**文件：`src/lib/wallet/rewardPool.ts`**

```typescript
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { invoke } from '@tauri-apps/api/core';
import type { RewardInfo, CreateRewardParams, ClaimRewardParams } from './types';

// 合约 ABI（从编译后的合约中导出）
import CMVHRewardPoolABI from '$lib/abi/CMVHRewardPool.json';

const REWARD_POOL_ADDRESS = '0x...' as Address; // 部署后的合约地址

export class RewardPoolClient {
  private publicClient;

  constructor(rpcUrl: string) {
    this.publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(rpcUrl),
    });
  }

  /**
   * 创建奖励（通过 Tauri 后端）
   */
  async createReward(params: CreateRewardParams): Promise<string> {
    try {
      const txHash = await invoke<string>('create_email_reward', {
        recipient: params.recipient,
        amountWact: params.amountWACT,
        subject: params.subject,
        from: params.from,
        to: params.to,
        expiryDays: params.expiryDays,
      });

      return txHash;
    } catch (error) {
      console.error('Failed to create reward:', error);
      throw error;
    }
  }

  /**
   * 领取奖励（通过 Tauri 后端）
   */
  async claimReward(params: ClaimRewardParams): Promise<string> {
    try {
      const txHash = await invoke<string>('claim_email_reward', {
        rewardId: params.rewardId,
        emailHash: params.emailHash,
        signature: params.signature,
        subject: params.subject,
        from: params.from,
        to: params.to,
      });

      return txHash;
    } catch (error) {
      console.error('Failed to claim reward:', error);
      throw error;
    }
  }

  /**
   * 查询用户的奖励列表
   */
  async getUserRewards(userAddress: Address, asRecipient: boolean): Promise<string[]> {
    const rewardIds = await this.publicClient.readContract({
      address: REWARD_POOL_ADDRESS,
      abi: CMVHRewardPoolABI,
      functionName: 'getUserRewards',
      args: [userAddress, asRecipient],
    }) as string[];

    return rewardIds;
  }

  /**
   * 获取奖励详情
   */
  async getRewardInfo(rewardId: string): Promise<RewardInfo> {
    const info = await this.publicClient.readContract({
      address: REWARD_POOL_ADDRESS,
      abi: CMVHRewardPoolABI,
      functionName: 'getRewardInfo',
      args: [rewardId as `0x${string}`],
    }) as any;

    return {
      rewardId,
      sender: info.sender,
      recipient: info.recipient,
      amount: info.amount,
      timestamp: Number(info.timestamp),
      expiryTime: Number(info.expiryTime),
      claimed: info.claimed,
      emailHash: info.emailHash,
    };
  }

  /**
   * 检查奖励是否可领取
   */
  async isRewardClaimable(rewardId: string): Promise<boolean> {
    return await this.publicClient.readContract({
      address: REWARD_POOL_ADDRESS,
      abi: CMVHRewardPoolABI,
      functionName: 'isRewardClaimable',
      args: [rewardId as `0x${string}`],
    }) as boolean;
  }
}
```

**文件：`src/lib/wallet/tokenApproval.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core';

/**
 * 授权 wACT 代币给奖励池合约
 */
export async function approveWACT(amount: string): Promise<string> {
  try {
    const txHash = await invoke<string>('approve_wact_token', {
      spender: REWARD_POOL_ADDRESS,
      amount,
    });

    return txHash;
  } catch (error) {
    console.error('Failed to approve wACT:', error);
    throw error;
  }
}

/**
 * 查询 wACT 授权额度
 */
export async function getWACTAllowance(owner: string): Promise<bigint> {
  const allowance = await invoke<string>('get_wact_allowance', {
    owner,
    spender: REWARD_POOL_ADDRESS,
  });

  return BigInt(allowance);
}

/**
 * 查询 wACT 余额
 */
export async function getWACTBalance(address: string): Promise<bigint> {
  const balance = await invoke<string>('get_wact_balance', {
    address,
  });

  return BigInt(balance);
}
```

#### 2.3 UI 组件

**文件：`src/routes/compose/RewardPanel.svelte`**

```svelte
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { RewardPoolClient } from '$lib/wallet/rewardPool';
  import { approveWACT, getWACTBalance, getWACTAllowance } from '$lib/wallet/tokenApproval';

  let enableReward = $state(false);
  let rewardAmount = $state('0.05');
  let expiryDays = $state(7);
  let wactBalance = $state<bigint>(0n);
  let needsApproval = $state(false);

  async function checkBalance() {
    const address = await invoke<string>('get_wallet_address');
    wactBalance = await getWACTBalance(address);
  }

  async function checkApproval() {
    const address = await invoke<string>('get_wallet_address');
    const allowance = await getWACTAllowance(address);
    const requiredAmount = BigInt(parseFloat(rewardAmount) * 1e18);
    needsApproval = allowance < requiredAmount;
  }

  async function handleApprove() {
    try {
      const txHash = await approveWACT(rewardAmount);
      console.log('Approval tx:', txHash);
      await checkApproval();
    } catch (error) {
      console.error('Approval failed:', error);
    }
  }

  $effect(() => {
    if (enableReward) {
      checkBalance();
      checkApproval();
    }
  });
</script>

<div class="reward-panel">
  <label>
    <input type="checkbox" bind:checked={enableReward} />
    附加 wACT 奖励
  </label>

  {#if enableReward}
    <div class="reward-settings">
      <div class="field">
        <label>奖励金额</label>
        <input
          type="number"
          bind:value={rewardAmount}
          min="0.01"
          step="0.01"
          on:change={checkApproval}
        />
        <span class="unit">wACT</span>
        <span class="balance">余额: {(Number(wactBalance) / 1e18).toFixed(2)} wACT</span>
      </div>

      <div class="field">
        <label>过期时间</label>
        <select bind:value={expiryDays}>
          <option value={7}>7 天</option>
          <option value={14}>14 天</option>
          <option value={30}>30 天</option>
        </select>
      </div>

      {#if needsApproval}
        <button class="approve-btn" on:click={handleApprove}>
          授权 wACT 代币
        </button>
      {/if}

      <div class="fee-info">
        <span>协议手续费: {(parseFloat(rewardAmount) * 0.005).toFixed(4)} wACT (0.5%)</span>
        <span>实际收到: {(parseFloat(rewardAmount) * 0.995).toFixed(4)} wACT</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .reward-panel {
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .reward-settings {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .approve-btn {
    background: #ff6b35;
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .fee-info {
    font-size: 0.85rem;
    color: #666;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
```

**文件：`src/routes/inbox/RewardBadge.svelte`**

```svelte
<script lang="ts">
  import type { RewardInfo } from '$lib/wallet/types';
  import { RewardPoolClient } from '$lib/wallet/rewardPool';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    emailHeaders: Record<string, string>;
    emailBody: string;
  }

  let { emailHeaders, emailBody }: Props = $props();

  let rewardInfo = $state<RewardInfo | null>(null);
  let isClaimable = $state(false);
  let claiming = $state(false);

  const rewardPoolClient = new RewardPoolClient('https://sepolia-rollup.arbitrum.io/rpc');

  async function loadRewardInfo() {
    const rewardHeader = emailHeaders['X-CMVH-Reward'];
    if (!rewardHeader) return;

    // 解析奖励字段：例如 "0.05 wACT"
    const match = rewardHeader.match(/^([\d.]+)\s+wACT$/);
    if (!match) return;

    // 查询链上奖励信息
    const emailHash = emailHeaders['X-CMVH-EmailHash'];
    // ... 查询逻辑
  }

  async function handleClaim() {
    if (!rewardInfo) return;

    claiming = true;
    try {
      const signature = emailHeaders['X-CMVH-Signature'];
      const subject = emailHeaders['Subject'];
      const from = emailHeaders['From'];
      const to = emailHeaders['To'];

      const txHash = await rewardPoolClient.claimReward({
        rewardId: rewardInfo.rewardId,
        emailHash: rewardInfo.emailHash,
        signature,
        subject,
        from,
        to,
      });

      console.log('Claimed reward, tx:', txHash);
      rewardInfo.claimed = true;
    } catch (error) {
      console.error('Claim failed:', error);
    } finally {
      claiming = false;
    }
  }

  $effect(() => {
    loadRewardInfo();
  });
</script>

{#if rewardInfo}
  <div class="reward-badge">
    <div class="reward-amount">
      💰 {(Number(rewardInfo.amount) / 1e18).toFixed(2)} wACT
    </div>

    {#if rewardInfo.claimed}
      <span class="status claimed">已领取</span>
    {:else if isClaimable}
      <button class="claim-btn" on:click={handleClaim} disabled={claiming}>
        {claiming ? '领取中...' : '立即领取'}
      </button>
    {:else}
      <span class="status pending">待领取</span>
    {/if}
  </div>
{/if}

<style>
  .reward-badge {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .reward-amount {
    font-size: 1.1rem;
    font-weight: bold;
  }

  .claim-btn {
    background: white;
    color: #667eea;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  .claim-btn:hover {
    background: #f0f0f0;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
  }

  .status.claimed {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
```

### 3. WalletConnect 集成流程

**步骤概览：**

1. **安装依赖**
```bash
npm install @walletconnect/web3wallet
npm install @walletconnect/utils
```

2. **初始化 WalletConnect**
```typescript
// src/lib/wallet/walletConnect.ts
import { Web3Wallet } from '@walletconnect/web3wallet';

export async function initWalletConnect() {
  const web3wallet = await Web3Wallet.init({
    projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
    metadata: {
      name: 'ColiMail',
      description: 'Blockchain-verified email client',
      url: 'https://colimail.com',
      icons: ['https://colimail.com/icon.png'],
    },
  });

  return web3wallet;
}
```

3. **连接钱包（扫码/深链接）**
```typescript
export async function connectWallet(web3wallet: Web3Wallet) {
  const { uri, approval } = await web3wallet.connect({
    chains: ['eip155:421614'], // Arbitrum Sepolia
    methods: ['eth_sendTransaction', 'personal_sign'],
    events: ['chainChanged', 'accountsChanged'],
  });

  // 显示二维码或深链接
  console.log('Connect URI:', uri);

  // 等待用户批准
  const session = await approval();
  return session;
}
```

4. **发送交易（通过已连接的钱包）**
```typescript
export async function sendTransaction(
  web3wallet: Web3Wallet,
  sessionTopic: string,
  tx: any
) {
  const result = await web3wallet.request({
    topic: sessionTopic,
    chainId: 'eip155:421614',
    request: {
      method: 'eth_sendTransaction',
      params: [tx],
    },
  });

  return result;
}
```

### 4. 开发检查清单

**后端（Rust）：**
- [ ] 实现 `ProviderManager`（RPC 连接管理）
- [ ] 实现 `RewardPoolClient`（合约交互）
- [ ] 实现 Tauri 命令：
  - [ ] `create_email_reward`
  - [ ] `claim_email_reward`
  - [ ] `get_user_rewards`
  - [ ] `approve_wact_token`
  - [ ] `get_wact_balance`
  - [ ] `get_wact_allowance`
- [ ] 安全存储集成（钱包私钥）
- [ ] 错误处理和日志记录

**前端（SvelteKit）：**
- [ ] 实现 `RewardPoolClient`（viem 集成）
- [ ] 实现 `RewardPanel` 组件（撰写邮件时添加奖励）
- [ ] 实现 `RewardBadge` 组件（显示可领取奖励）
- [ ] 实现 `ClaimModal` 组件（领取奖励弹窗）
- [ ] 实现 `MyRewards` 页面（奖励管理）
- [ ] WalletConnect 集成
- [ ] 代币授权流程 UI
- [ ] 交易状态跟踪（pending/confirmed/failed）
- [ ] 错误提示和用户反馈

**测试：**
- [ ] 后端单元测试（Rust tests）
- [ ] 前端组件测试（Vitest）
- [ ] 端到端测试（Tauri e2e）
- [ ] 合约交互集成测试
- [ ] WalletConnect 连接测试

---

## 开发计划

### Week 1-2: 智能合约开发

**任务：**
1. 实现 `CMVHRewardPoolV1.sol` 核心逻辑
2. 实现 UUPS 代理合约
3. 编写单元测试（目标：100 tests）
4. 编写集成测试（与 CMVHVerifier 互操作）
5. Gas 优化（目标：创建 <80k, 领取 <70k）
6. 部署到 Arbitrum Sepolia

**交付物：**
- ✅ CMVHRewardPoolV1.sol 合约
- ✅ CMVHRewardPoolProxy.sol 代理
- ✅ MockWACTToken.sol 测试代币
- ✅ 100+ 测试全部通过
- ✅ Gas 优化报告
- ✅ 部署脚本和文档

### Week 3-4: 后端集成（Rust）

**任务：**
1. 实现 `ProviderManager` 模块
2. 实现 `RewardPoolClient` 模块
3. 实现 WalletConnect 集成（可选）
4. 实现 Tauri 命令
5. 安全存储集成
6. 单元测试和集成测试

**交付物：**
- ✅ 完整的 Rust 后端模块
- ✅ Tauri 命令 API
- ✅ 安全存储实现
- ✅ 单元测试覆盖

### Week 5-6: 前端集成（SvelteKit）

**任务：**
1. 实现 `RewardPoolClient`（TypeScript + viem）
2. 实现 UI 组件：
   - RewardPanel（撰写邮件）
   - RewardBadge（收件箱）
   - ClaimModal（领取弹窗）
   - MyRewards（奖励管理页）
3. 实现代币授权流程
4. 实现交易状态跟踪
5. 端到端测试

**交付物：**
- ✅ 完整的前端 UI
- ✅ 用户体验流畅
- ✅ 组件测试覆盖
- ✅ 端到端测试通过

### Week 7: 测试和优化

**任务：**
1. 集成测试（合约 + 后端 + 前端）
2. 性能优化
3. 用户体验优化
4. Bug 修复
5. 文档更新

**交付物：**
- ✅ 所有测试通过
- ✅ 性能达标
- ✅ 文档完整

---

## 风险评估

### 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| UUPS 升级失败 | 高 | 低 | 充分测试，使用 OpenZeppelin 标准实现 |
| Gas 成本过高 | 中 | 中 | 优化存储布局，批量操作，Arbitrum L2 优势 |
| WalletConnect 兼容性 | 中 | 中 | 支持多种钱包，回退方案 |
| 代币流动性不足 | 高 | 中 | 初期使用测试代币，主网前建立流动性池 |

### 安全风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 重放攻击 | 高 | 中 | 邮件哈希唯一性验证 |
| 重入攻击 | 高 | 低 | ReentrancyGuard，checks-effects-interactions |
| 签名伪造 | 高 | 低 | 使用 CMVHVerifier 验证 |
| 抢跑攻击 | 中 | 中 | 时间锁机制 |
| 智能合约 Bug | 高 | 低 | 充分测试，审计，渐进式发布 |

### 经济风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 代币价格波动 | 中 | 高 | 稳定币选项，动态调整最小金额 |
| 协议费过高 | 中 | 中 | 参数可调整，社区治理 |
| 垃圾邮件攻击 | 中 | 中 | 最小奖励限制，协议费 |

---

## 附录

### A. 合约接口完整定义

见 `contracts/contracts/interfaces/ICMVHRewardPool.sol`

### B. ABI 导出

部署后自动生成：
- `contracts/abi/CMVHRewardPool.json`
- `contracts/abi/MockWACTToken.json`

### C. 测试网信息

**Arbitrum Sepolia Testnet:**
- Chain ID: 421614
- RPC: https://sepolia-rollup.arbitrum.io/rpc
- Explorer: https://sepolia.arbiscan.io
- Faucet: https://faucet.arbitrum.io

**测试代币水龙头:**
- wACT 测试代币：https://colimail.com/faucet

### D. 参考资料

- OpenZeppelin UUPS: https://docs.openzeppelin.com/contracts/5.x/api/proxy#UUPSUpgradeable
- WalletConnect Docs: https://docs.walletconnect.com/
- Viem Documentation: https://viem.sh/
- Ethers-rs: https://github.com/gakonst/ethers-rs

---

**下一步：** 等待方案确认后开始实施。
