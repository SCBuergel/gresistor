import { ShamirConfig, KeyShard } from './types';

export class ShamirSecretSharing {
  private config: ShamirConfig;

  constructor(config: ShamirConfig) {
    this.config = config;
  }

  /**
   * Splits a secret into N shares using Shamir Secret Sharing
   */
  async splitSecret(secret: Uint8Array): Promise<KeyShard[]> {
    const { threshold, totalShares } = this.config;
    
    // For simplicity, we'll use a basic polynomial-based approach
    // In a real implementation, you'd want to use a proper finite field
    
    const shares: KeyShard[] = [];
    
    // Generate random coefficients for the polynomial
    const coefficients: Uint8Array[] = [secret]; // a0 = secret
    
    for (let i = 1; i < threshold; i++) {
      coefficients.push(crypto.getRandomValues(new Uint8Array(secret.length)));
    }
    
    // Generate shares by evaluating the polynomial at different points
    for (let i = 1; i <= totalShares; i++) {
      const shareData = this.evaluatePolynomial(i, coefficients);
      shares.push({
        id: `share_${i}`,
        data: shareData,
        threshold,
        totalShares
      });
    }
    
    return shares;
  }

  /**
   * Reconstructs the secret from shares using Lagrange interpolation
   */
  async reconstructSecret(shares: KeyShard[]): Promise<Uint8Array> {
    if (shares.length < this.config.threshold) {
      throw new Error(`Need at least ${this.config.threshold} shares to reconstruct the secret`);
    }
    
    // For simplicity, we'll use the first 'threshold' shares
    const selectedShares = shares.slice(0, this.config.threshold);
    
    // Extract x-coordinates (share indices) and y-coordinates (share data)
    const xCoords: number[] = [];
    const yCoords: Uint8Array[] = [];
    
    for (let i = 0; i < selectedShares.length; i++) {
      const shareIndex = i + 1; // Share indices start from 1
      xCoords.push(shareIndex);
      yCoords.push(selectedShares[i].data);
    }
    
    // Use Lagrange interpolation to reconstruct the secret
    return this.lagrangeInterpolate(xCoords, yCoords);
  }

  /**
   * Validates that the shares are consistent
   */
  validateShards(shards: KeyShard[]): boolean {
    if (shards.length === 0) return false;
    
    const firstShard = shards[0];
    return shards.every(shard => 
      shard.threshold === firstShard.threshold &&
      shard.totalShares === firstShard.totalShares &&
      shard.data.length === firstShard.data.length
    );
  }

  /**
   * Evaluates a polynomial at a given point
   */
  private evaluatePolynomial(x: number, coefficients: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(coefficients[0].length);
    
    for (let i = 0; i < coefficients.length; i++) {
      const term = this.multiplyByScalar(coefficients[i], Math.pow(x, i));
      this.xorArrays(result, term);
    }
    
    return result;
  }

  /**
   * Performs Lagrange interpolation to reconstruct the secret
   */
  private lagrangeInterpolate(xCoords: number[], yCoords: Uint8Array[]): Uint8Array {
    const secret = new Uint8Array(yCoords[0].length);
    
    for (let i = 0; i < xCoords.length; i++) {
      let lagrangeCoeff = 1;
      
      for (let j = 0; j < xCoords.length; j++) {
        if (i !== j) {
          lagrangeCoeff *= xCoords[j] / (xCoords[j] - xCoords[i]);
        }
      }
      
      const term = this.multiplyByScalar(yCoords[i], lagrangeCoeff);
      this.xorArrays(secret, term);
    }
    
    return secret;
  }

  /**
   * Multiplies a byte array by a scalar (simplified)
   */
  private multiplyByScalar(data: Uint8Array, scalar: number): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = (data[i] * scalar) % 256;
    }
    return result;
  }

  /**
   * XORs two byte arrays
   */
  private xorArrays(a: Uint8Array, b: Uint8Array): void {
    for (let i = 0; i < a.length; i++) {
      a[i] ^= b[i];
    }
  }
} 