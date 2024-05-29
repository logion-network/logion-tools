import { BinaryToTextEncoding } from "crypto";

export const ENCODING: BinaryToTextEncoding = "base64";

export interface Suri {
    suriFile: string;
}

export interface Secrets {
    secret1: string;
    secret2: string;
}
