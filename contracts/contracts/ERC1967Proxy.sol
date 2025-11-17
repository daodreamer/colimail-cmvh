// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title ERC1967Proxy
 * @dev Re-export of OpenZeppelin's ERC1967Proxy for Hardhat Ignition
 *
 * This contract is a thin wrapper that re-exports OpenZeppelin's ERC1967Proxy.
 * It's required for Hardhat Ignition to properly deploy the proxy contract.
 *
 * The ERC1967Proxy is a standard proxy implementation that:
 * - Delegates all calls to an implementation contract
 * - Uses ERC-1967 storage slots to avoid storage collisions
 * - Supports upgrades through the UUPS pattern
 */
contract ERC1967ProxyWrapper is ERC1967Proxy {
    /**
     * @dev Initializes the proxy with an implementation and optional data
     * @param implementation Address of the implementation contract
     * @param _data Calldata to execute on the implementation during initialization
     */
    constructor(address implementation, bytes memory _data) ERC1967Proxy(implementation, _data) {}
}
