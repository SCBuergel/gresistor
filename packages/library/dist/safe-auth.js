"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeAuthService = void 0;
class SafeAuthService {
    constructor(config) {
        this.config = config;
    }
    /**
     * Checks if address is a Safe owner
     */
    async isOwner(address) {
        return this.config.owners.includes(address.toLowerCase());
    }
    /**
     * Gets the Safe configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.SafeAuthService = SafeAuthService;
//# sourceMappingURL=safe-auth.js.map