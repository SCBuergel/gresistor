declare module 'secrets.js-grempe';
declare module 'secrets.js';

declare module 'crypto' {
  export function randomBytes(size: number): Buffer;
  export function createHash(algorithm: string): {
    update(data: Buffer | string): void;
    digest(encoding?: string): string | Buffer;
  };
  export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer): {
    update(data: Buffer): Buffer;
    final(): Buffer;
    getAuthTag(): Buffer;
  };
  export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer): {
    setAuthTag(tag: Buffer): void;
    update(data: Buffer): Buffer;
    final(): Buffer;
  };
}

declare module 'shamirs-secret-sharing' {
  export function split(secret: Uint8Array, options: { shares: number; threshold: number }): Uint8Array[];
  export function combine(shares: Uint8Array[]): Uint8Array;
} 