# 📧 ColiMail Verification Header (CMVH)

## Blockchain-Based Email Authentication & Incentive Framework

**Version:** 1.0.0  
**Author:** ColiMail Labs (Dao Dreamer)  
**Date:** 2025-11-04  
**License:** MIT

---

## 🧭 Overview

**ColiMail Verification Header (CMVH)** 是一种开放标准，用于将 **区块链身份验证、邮件防伪与激励机制** 引入现有电子邮件体系（IMAP/SMTP），无需修改服务器端或邮件协议。

它允许任何邮件客户端（例如 ColiMail）验证：

- 邮件发送者的链上身份（钱包签名 / ENS / 合约认证）
- 邮件内容是否被篡改（哈希比对）
- 邮件是否具有奖励或可信来源（on-chain proof）

---

## ✨ Key Features

| 模块 | 功能说明 | 是否需要ColiMail发件方 |
|------|-----------|----------------|
| 🪪 链上签名验证 | 验证发件人钱包签名、ENS或合约身份 | ❌ 不需要 |
| ⛓️ 邮件哈希上链 | 可选：将邮件哈希存储至Arbitrum合约 | ✅ 可选 |
| 🎯 防伪信任等级 | UI显示"Verified / On-Chain Verified"状态 | ❌ 不需要 |
| 💰 激励系统 | 签名邮件可携带wACT奖励，收件方领取 | ✅ 可选 |
| 🔐 附件完整性 | 可扩展：IPFS哈希验证附件 | ✅ 可选 |

---

## 🧱 Architecture

```text
┌────────────────────────────┐
│ User Email                 │
│ (Any IMAP/SMTP provider)   │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ ColiMail Client            │
│ (Rust + Tauri + TypeScript)│
│ - Header Parser (CMVH)     │
│ - Signature Verifier       │
│ - Blockchain Verifier      │
│ - Incentive Claim Module   │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Blockchain Layer           │
│ (Arbitrum Smart Contract)  │
│ - CMVHVerifier.sol         │
│ - CMVHRewardPool.sol       │
│ - wACT Token Integration   │
└────────────────────────────┘
```

---

## 📜 CMVH Header Specification

核心头字段（详细规范见 [RFC-CMVH-0001](./docs/RFC-CMVH-0001.md)）：

```text
X-CMVH-Version: 1
X-CMVH-Address: 0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3
X-CMVH-Chain: Arbitrum
X-CMVH-Timestamp: 1730733600
X-CMVH-HashAlgo: keccak256
X-CMVH-Signature: 0xd54f3b8b9a...ae99
X-CMVH-ENS: alice.eth
X-CMVH-Reward: 0.05 wACT
X-CMVH-ProofURL: ipfs://QmY4H7...
```

---

## 🧩 Components Overview

### 1. CMVH-Signer SDK

用于发件人签名生成，可集成于插件、网页或CLI工具中。

**语言支持：**

- JavaScript/TypeScript (`@colimail/signer`)
- Rust (for native integration)

**函数示例：**

```ts
import { signEmail } from "@colimail/signer";

const headers = await signEmail({
  privateKey,
  emailBody,
  from,
  to,
  subject,
});
console.log(headers); // 输出 X-CMVH-* 头字段
```

### 2. CMVH-Verifier Contract (Solidity)

位于 `contracts/CMVHVerifier.sol`

```solidity
interface ICMVHVerifier {
  function isValidSignature(
      address signer,
      bytes32 hash,
      bytes calldata sig
  ) external view returns (bool);
}
```

部署网络：

- Arbitrum One 主网
- Arbitrum Sepolia 测试网

### 3. ColiMail Client Integration (Tauri + TypeScript)

在 Rust 后端调用 viem 或 ethers-rs 验证签名。

关键模块：

- `cmvh_parser.ts` → 提取邮件头并生成哈希
- `cmvh_verifier.ts` → 校验签名与合约
- `cmvh_ui.tsx` → UI中显示验证状态徽章

示例：

```ts
const verified = await verifyCMVH(emailHeaders, emailBody);
if (verified.onchain) showBadge("🔵 On-Chain Verified");
```

---

## 🧭 Development Plan

### Phase 1 — Core RFC & SDK (2 weeks)

- ✅ 定义 RFC-CMVH-0001
- ✅ 实现 @colimail/signer NPM 包
- ✅ Rust CLI 工具 cmvh-cli 用于签名生成
- ✅ 单元测试 + JSON Schema 校验

### Phase 2 — Smart Contract (2 weeks)

- 实现并部署 CMVHVerifier.sol
- 支持 EIP-191 / EIP-1271 签名验证
- 部署到 Arbitrum Sepolia
- 提供 TypeScript 合约绑定（viem ABI）

### Phase 3 — Client Integration (3 weeks)

- ColiMail 客户端增加 CMVH 模块
- 邮件头解析器
- 签名验证逻辑
- UI 状态徽章显示
- 添加设置选项："启用区块链验证层"

### Phase 4 — Incentive Layer (3 weeks)

- 部署 CMVHRewardPool.sol
- 允许验证成功的邮件领取 wACT 奖励
- ColiMail 客户端集成奖励领取界面
- 绑定用户钱包

### Phase 5 — Public Beta & Ecosystem (4 weeks)

- 发布 colimail-signer 浏览器扩展（适配 Gmail/Outlook）
- 发布示范邮件验证门户（Web版）
- 吸引早期开发者接入签名工具
- 编写 "CMVH for Developers" 指南文档

---

## 📁 Project Structure

```text
colimail-cmvh/
├── contracts/
│   ├── CMVHVerifier.sol
│   ├── CMVHRewardPool.sol
│   └── test/
├── sdk/
│   ├── signer-js/
│   ├── signer-rust/
│   └── examples/
├── client/
│   ├── src-tauri/
│   ├── src/ts/cmvh_parser.ts
│   ├── src/ts/cmvh_verifier.ts
│   ├── src/ui/CMVHStatus.tsx
├── docs/
│   ├── RFC-CMVH-0001.md
│   ├── DEV_GUIDE.md
│   └── API_REFERENCE.md
└── README.md
```

---

## 🧪 Testing Plan

| 测试模块 | 方法 | 验证目标 |
|---------|------|---------|
| SDK 单元测试 | Jest / Rust test | 签名一致性、哈希稳定性 |
| 合约测试 | Hardhat / Foundry | 合约签名验证正确性 |
| 客户端集成测试 | Cypress / Playwright | 邮件解析 + 状态显示 |
| 端到端测试 | Tauri sandbox | 从发件签名到收件验证完整流程 |

---

## 💡 Example Use Case

一封带有链上签名的邮件：

```text
From: alice@gmail.com
To: bob@outlook.com
Subject: Partnership Proposal
X-CMVH-Address: 0x53dA9B...
X-CMVH-Signature: 0xfda391...
X-CMVH-ENS: alice.eth
X-CMVH-Reward: 0.05 wACT
```

ColiMail 客户端解析后：

- 自动验证签名
- 查询 ENS → 显示 "✅ alice.eth verified"
- 识别奖励字段 → 提示 "💰 领取 0.05 wACT"

---

## 🛠️ Tech Stack

| 层 | 技术 | 说明 |
|---|------|-----|
| 客户端 | Rust + Tauri + TypeScript + React | ColiMail 桌面应用 |
| 合约 | Solidity 0.8.28 + Hardhat Ignition | Arbitrum主网验证逻辑 |
| SDK | TypeScript + Rust | 签名与验证工具 |
| 前端Web演示 | Next.js / Astro | 邮件验证门户 |
| 钱包接口 | viem + WalletConnect | 用户钱包交互 |

---

## 🔮 Future Extensions

| 模块 | 功能描述 |
|-----|---------|
| **CMVH-Encrypt** | 邮件内容加密，使用钱包公钥派生AES密钥 |
| **CMVH-Attach** | 附件完整性验证（IPFS哈希） |
| **CMVH-Relay** | 去中心化时间戳证明 |
| **ColiMail ENS Bridge** | 将邮箱绑定 ENS 名称 |
| **AI Spam Shield** | 利用签名验证 + AI 识别优先级投递 |

---

## 🤝 Governance & Open Source

CMVH 标准及相关实现由 ColiMail Foundation 维护，采用开放改进提案流程（CIP: ColiMail Improvement Proposal）。

社区可提交：

- 新增Header字段
- 新合约扩展模块
- 安全建议与优化方案

所有组件均基于 MIT License 发布。

---

## 🗺️ Roadmap Summary

| 阶段 | 时间 | 目标 |
|-----|------|------|
| Phase 1 | 2025 Q4 | 发布CMVH RFC + Signer SDK |
| Phase 2 | 2026 Q1 | 部署Verifier合约 |
| Phase 3 | 2026 Q1-Q2 | 客户端集成验证模块 |
| Phase 4 | 2026 Q2 | 激励池与wACT奖励上线 |
| Phase 5 | 2026 Q3 | 推出浏览器扩展 + 开发者生态 |

---

## 🧩 Vision Statement

> "ColiMail brings blockchain trust to everyday communication."

我们的目标是打造新一代信任邮件生态系统：

- 无需自建服务器
- 兼容所有邮箱
- 支持链上签名验证
- 激励安全通信与真实身份
