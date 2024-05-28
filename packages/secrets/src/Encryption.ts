import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class Encryption {

    encrypt(params: { data: Buffer, key: Buffer }): Buffer {
        const { data, key } = params;
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([ cipher.update(data), cipher.final() ]);
        return Buffer.concat([ iv, encrypted ]);
    }

    decrypt(params: { encrypted: Buffer, key: Buffer }): Buffer {
        const { encrypted, key } = params;
        const iv = encrypted.subarray(0, IV_LENGTH);
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        const encryptedData = encrypted.subarray(IV_LENGTH);
        return Buffer.concat([ decipher.update(encryptedData), decipher.final() ]);
    }
}
