"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.SafeAuthService = exports.StorageService = exports.ShamirSecretSharing = exports.EncryptionService = exports.BackupService = void 0;
// Core services
var backup_1 = require("./backup");
Object.defineProperty(exports, "BackupService", { enumerable: true, get: function () { return backup_1.BackupService; } });
var encryption_1 = require("./encryption");
Object.defineProperty(exports, "EncryptionService", { enumerable: true, get: function () { return encryption_1.EncryptionService; } });
var shamir_1 = require("./shamir");
Object.defineProperty(exports, "ShamirSecretSharing", { enumerable: true, get: function () { return shamir_1.ShamirSecretSharing; } });
var storage_1 = require("./storage");
Object.defineProperty(exports, "StorageService", { enumerable: true, get: function () { return storage_1.StorageService; } });
var safe_auth_1 = require("./safe-auth");
Object.defineProperty(exports, "SafeAuthService", { enumerable: true, get: function () { return safe_auth_1.SafeAuthService; } });
// Types
__exportStar(require("./types"), exports);
// Main API
var backup_2 = require("./backup");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return backup_2.BackupService; } });
//# sourceMappingURL=index.js.map