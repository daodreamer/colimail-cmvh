// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Import and re-export OpenZeppelin contracts for testing
// This ensures they are compiled and available in artifacts
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Dummy contract to ensure compilation
contract ProxyHelper {
    function getProxyAddress(address implementation, bytes memory data) external returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, data);
        return address(proxy);
    }
}
