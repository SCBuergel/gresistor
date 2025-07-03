import { SafeConfig } from './types';

export class SafeAuthService {
  private config: SafeConfig;

  constructor(config: SafeConfig) {
    this.config = config;
  }

  /**
   * Checks if address is a Safe owner
   */
  async isOwner(address: string): Promise<boolean> {
    return this.config.owners.includes(address.toLowerCase());
  }

  /**
   * Gets the Safe configuration
   */
  getConfig(): SafeConfig {
    return { ...this.config };
  }
} 