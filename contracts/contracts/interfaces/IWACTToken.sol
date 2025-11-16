// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWACTToken
 * @notice Interface for wACT (Wrapped ACT) token
 * @dev Extends standard ERC20 interface
 */
interface IWACTToken is IERC20 {
    /**
     * @notice Get token decimals
     * @return Number of decimals (should be 18)
     */
    function decimals() external view returns (uint8);
}
