import { SafeConfig } from './types';
export declare class SafeAuthService {
    private config;
    constructor(config: SafeConfig);
    /**
     * Checks if address is a Safe owner
     */
    isOwner(address: string): Promise<boolean>;
    /**
     * Gets the Safe configuration
     */
    getConfig(): SafeConfig;
}
//# sourceMappingURL=safe-auth.d.ts.map