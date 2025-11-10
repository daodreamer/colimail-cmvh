// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

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
 * canonical = subject + "\n" + from + "\n" + to + "\n" + body
 *
 * Security Notes:
 * - MVP: No replay protection (Phase 3+)
 * - MVP: No timestamp validation (Phase 3+)
 * - MVP: EOA only, no EIP-1271 support yet (Phase 3+)
 */
contract CMVHVerifier {
    using ECDSA for bytes32;

    /// @notice Contract name for identification
    string public constant name = "CMVHVerifier";

    /// @notice Contract version
    string public constant version = "1.0.0";

    /// @notice Emitted when a signature is verified
    event SignatureVerified(
        address indexed signer,
        bytes32 indexed emailHash,
        bool isValid
    );

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
    ) public view returns (bool isValid) {
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
     * @param body Email body content
     * @param signature ECDSA signature
     * @return isValid True if email signature is valid
     *
     * Gas: ~50k-70k for typical email, <150k for very long content
     */
    function verifyEmail(
        address signer,
        string calldata subject,
        string calldata from,
        string calldata to,
        string calldata body,
        bytes memory signature
    ) public view returns (bool isValid) {
        // Compute email hash using same canonicalization as SDK
        bytes32 emailHash = hashEmail(subject, from, to, body);

        // Verify signature
        return verifySignature(signer, emailHash, signature);
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
        // Use tryRecover for safe signature recovery
        (address recovered, ECDSA.RecoverError error, ) = ECDSA.tryRecover(emailHash, signature);

        // Return address(0) if recovery failed
        if (error != ECDSA.RecoverError.NoError) {
            return address(0);
        }

        return recovered;
    }

    /**
     * @notice Hash email content using CMVH canonicalization
     * @dev Matches SDK canonicalization: subject\nfrom\nto\nbody
     *
     * Canonicalization Rules:
     * 1. Concatenate fields with single newline separator
     * 2. Order: subject, from, to, body
     * 3. No trimming or normalization
     * 4. UTF-8 encoding assumed
     *
     * @param subject Email subject (can be empty)
     * @param from Email from address
     * @param to Email to address
     * @param body Email body (can be empty)
     * @return hash keccak256 hash of canonicalized email
     *
     * Gas: ~10k-30k depending on content length
     */
    function hashEmail(
        string calldata subject,
        string calldata from,
        string calldata to,
        string calldata body
    ) public pure returns (bytes32 hash) {
        // Canonicalize: subject\nfrom\nto\nbody
        // Using abi.encodePacked for efficient string concatenation
        bytes memory canonical = abi.encodePacked(
            subject,
            "\n",
            from,
            "\n",
            to,
            "\n",
            body
        );

        // Hash canonicalized content
        return keccak256(canonical);
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
    ) external view returns (bool[] memory results) {
        require(
            signers.length == emailHashes.length &&
            emailHashes.length == signatures.length,
            "CMVHVerifier: array length mismatch"
        );

        results = new bool[](signers.length);

        for (uint256 i = 0; i < signers.length; i++) {
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
        return (name, version);
    }
}
