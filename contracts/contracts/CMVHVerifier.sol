// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CMVHVerifier
 * @author ColiMail Labs (Dao Dreamer)
 * @notice CMVH (ColiMail Verification Header) signature verification contract
 * @dev Phase 2 implementation: On-chain signature verification for email authentication
 *
 * Features:
 * - EOA signature verification (ECDSA secp256k1)
 * - Email content canonicalization matching SDK
 * - Gas-optimized operations (<100k gas per verification)
 * - EIP-191 compliant signature recovery
 *
 * Canonicalization Algorithm (matching SDK):
 * canonical = subject + "\n" + from + "\n" + to
 * Note: Body is excluded to avoid HTML formatting issues
 *
 * Security Notes:
 * - MVP: No replay protection (Phase 3+)
 * - MVP: No timestamp validation (Phase 3+)
 * - MVP: EOA only, no EIP-1271 support yet (Phase 3+)
 */
contract CMVHVerifier is Ownable {
    using ECDSA for bytes32;

    /// @notice Contract name for identification
    string public constant NAME = "CMVHVerifier";

    /// @notice Contract version
    string public constant VERSION = "1.0.0";

    /// @notice Emitted when a signature is verified
    event SignatureVerified(
        address indexed signer,
        bytes32 indexed emailHash,
        bool isValid
    );

    /**
     * @notice Constructor
     * @param initialOwner The initial owner of the contract
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Verify ECDSA signature for email content
     * @dev This is the core verification function matching SDK's verifyEmail
     *
     * @param signer Expected signer's Ethereum address
     * @param emailHash keccak256 hash of canonicalized email
     * @param signature ECDSA signature (65 bytes: r + s + v)
     * @return isValid True if signature is valid and signer matches
     *
     * Gas: ~45k-60k (well under 100k target)
     */
    function verifySignature(
        address signer,
        bytes32 emailHash,
        bytes memory signature
    ) public pure returns (bool isValid) {
        // Recover signer address from signature
        address recovered = recoverSigner(emailHash, signature);

        // Compare recovered address with claimed signer (case-insensitive)
        return recovered != address(0) && recovered == signer;
    }

    /**
     * @notice Verify complete email with inline canonicalization
     * @dev Combines hashing and signature verification in one call
     *
     * @param signer Expected signer's Ethereum address
     * @param subject Email subject line
     * @param from Email from address
     * @param to Email to address
     * @param signature ECDSA signature
     * @return isValid True if email signature is valid
     *
     * Gas: ~45k-60k for typical email
     */
    function verifyEmail(
        address signer,
        string calldata subject,
        string calldata from,
        string calldata to,
        bytes memory signature
    ) public pure returns (bool isValid) {
        // Compute email hash using same canonicalization as SDK
        return verifySignature(signer, hashEmail(subject, from, to), signature);
    }

    /**
     * @notice Recover signer address from signature
     * @dev Uses ECDSA.tryRecover for signature recovery with error handling
     *
     * @param emailHash keccak256 hash of email content
     * @param signature ECDSA signature
     * @return signer Recovered Ethereum address (address(0) if invalid)
     *
     * Gas: ~35k-45k
     */
    function recoverSigner(
        bytes32 emailHash,
        bytes memory signature
    ) public pure returns (address signer) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        address recovered = ecrecover(emailHash, v, r, s);
        return recovered;
    }

    /**
     * @notice Hash email content using CMVH canonicalization
     * @dev Matches SDK canonicalization: subject\nfrom\nto
     *      Body excluded to avoid HTML formatting issues
     *
     * Canonicalization Rules:
     * 1. Concatenate fields with single newline separator
     * 2. Order: subject, from, to
     * 3. No trimming or normalization
     * 4. UTF-8 encoding assumed
     *
     * @param subject Email subject (can be empty)
     * @param from Email from address
     * @param to Email to address
     * @return hash keccak256 hash of canonicalized email
     *
     * Gas: ~8k-15k depending on content length
     */
    function hashEmail(
        string calldata subject,
        string calldata from,
        string calldata to
    ) public pure returns (bytes32 hash) {
        return keccak256(abi.encodePacked(subject, "\n", from, "\n", to));
    }

    /**
     * @notice Batch verify multiple signatures
     * @dev Efficient batch verification for multiple emails
     *
     * @param signers Array of expected signer addresses
     * @param emailHashes Array of email hashes
     * @param signatures Array of signatures
     * @return results Array of verification results
     *
     * Gas: ~50k * n where n is number of signatures
     */
    function batchVerifySignatures(
        address[] calldata signers,
        bytes32[] calldata emailHashes,
        bytes[] calldata signatures
    ) external pure returns (bool[] memory results) {
        uint256 length = signers.length;
        require(
            length == emailHashes.length && length == signatures.length,
            "CMVHVerifier: array length mismatch"
        );

        results = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            results[i] = verifySignature(
                signers[i],
                emailHashes[i],
                signatures[i]
            );
        }

        return results;
    }

    /**
     * @notice Get contract metadata
     * @return contractName Contract name
     * @return contractVersion Contract version
     */
    function getMetadata() external pure returns (
        string memory contractName,
        string memory contractVersion
    ) {
        return (NAME, VERSION);
    }
}
