import { ShamirConfig, KeyShard } from './types';
export declare class ShamirSecretSharing {
    private config;
    constructor(config: ShamirConfig);
    /**
     * Splits a secret into N shares using Shamir Secret Sharing
     */
    splitSecret(secret: Uint8Array): Promise<KeyShard[]>;
    /**
     * Reconstructs the secret from shares using Lagrange interpolation
     */
    reconstructSecret(shares: KeyShard[]): Promise<Uint8Array>;
    /**
     * Validates that the shares are consistent
     */
    validateShards(shards: KeyShard[]): boolean;
    /**
     * Evaluates a polynomial at a given point
     */
    private evaluatePolynomial;
    /**
     * Performs Lagrange interpolation to reconstruct the secret
     */
    private lagrangeInterpolate;
    /**
     * Multiplies a byte array by a scalar (simplified)
     */
    private multiplyByScalar;
    /**
     * XORs two byte arrays
     */
    private xorArrays;
}
//# sourceMappingURL=shamir.d.ts.map