import { Hash } from "@logion/node-api";
import { isValidOrThrow } from "./TermsAndConditionsValidator.js";
import { TermsAndConditionsElementType, isValidMime, isTokenType } from "@logion/client";

export function toItemId(maybeHex: string): Hash | undefined {
    if(Hash.isValidHexHash(maybeHex)) {
        return Hash.fromHex(maybeHex);
    } else if(maybeHex.startsWith("0x")) {
        return undefined;
    } else {
        return Hash.of(maybeHex);
    }
}

export interface CsvItemWithoutFile {
    id?: Hash;
    displayId: string;
    description: string;
    validationError?: string;
    termsAndConditionsType: string;
    termsAndConditionsParameters: string;
}

export interface CsvItemWithFile extends CsvItemWithoutFile {
    fileName: string;
    fileContentType: string;
    fileSize: string;
    fileHash: Hash;
}

export interface CsvItemToken {
    tokenType: string;
    tokenId: string;
    tokenIssuance: string;
}

export interface CsvItemWithFileAndToken extends CsvItemWithFile, CsvItemToken {
    restrictedDelivery: boolean;
}

export interface CsvItemWithToken extends CsvItemWithoutFile, CsvItemToken {

}

export type CsvItem = CsvItemWithoutFile | CsvItemWithFile | CsvItemWithFileAndToken | CsvItemWithToken;

export const COLUMNS_WITHOUT_FILE = ['ID', 'DESCRIPTION', 'TERMS_AND_CONDITIONS TYPE', 'TERMS_AND_CONDITIONS PARAMETERS'] as const;
export const COLUMNS_WITH_FILE = [ ...COLUMNS_WITHOUT_FILE, 'FILE NAME', 'FILE CONTENT TYPE', 'FILE SIZE', 'FILE HASH'] as const;
export const TOKEN_COLUMNS = ['TOKEN TYPE', 'TOKEN ID', 'TOKEN ISSUANCE'] as const;
export const COLUMNS_WITH_FILE_AND_TOKEN = [ ...COLUMNS_WITH_FILE, 'RESTRICTED', ...TOKEN_COLUMNS] as const;
export const COLUMNS_WITH_TOKEN = [ ...COLUMNS_WITHOUT_FILE, ...TOKEN_COLUMNS] as const;

type RowWithoutFile = {
    [K in typeof COLUMNS_WITHOUT_FILE[number]]: string
}

type RowWithFile = {
    [K in typeof COLUMNS_WITH_FILE[number]]: string
}

type RowWithFileAndToken = {
    [K in typeof COLUMNS_WITH_FILE_AND_TOKEN[number]]: string
}

type RowWithToken = {
    [K in typeof COLUMNS_WITH_TOKEN[number]]: string
}

export enum CsvRowType {
    WithoutFile = "WithoutFile",
    WithFile = "WithFile",
    WithFileAndToken = "WithFileAndToken",
    WithToken = "WithToken",
}

const CSV_ROW_TYPE_VALUES = [ CsvRowType.WithoutFile, CsvRowType.WithFile, CsvRowType.WithFileAndToken, CsvRowType.WithToken ];

const columnsByType: Record<CsvRowType, readonly string[]> = {
    [CsvRowType.WithoutFile]: COLUMNS_WITHOUT_FILE,
    [CsvRowType.WithFile]: COLUMNS_WITH_FILE,
    [CsvRowType.WithFileAndToken]: COLUMNS_WITH_FILE_AND_TOKEN,
    [CsvRowType.WithToken]: COLUMNS_WITH_TOKEN,
};

export type CsvRow = RowWithoutFile | RowWithFile | RowWithFileAndToken | RowWithToken;

export interface SuccessfulReadItemsCsv {
    items: CsvItem[];
    rowType: CsvRowType;
    fullyValidated: boolean;
    errorSummary?: Record<string, number>;
}

export interface FailedReadItemsCsv {
    error: string;
}

export type ReadItemsCsvResult = SuccessfulReadItemsCsv | FailedReadItemsCsv;

export class CsvValidator {

    private rows: CsvItem[] = [];
    private ids: Record<string, null> = {};
    private rowType: CsvRowType | undefined;
    private errors: Record<string, number> = {};

    result(): ReadItemsCsvResult {
        if(this.rowType !== undefined) {
            if (Object.keys(this.errors).length === 0) {
                return {
                    items: this.rows,
                    rowType: this.rowType,
                    fullyValidated: true,
                }
            } else {
                return {
                    items: this.rows,
                    rowType: this.rowType,
                    fullyValidated: false,
                    errorSummary: this.errors,
                }
            }
        } else {
            return { error: "Given file is empty" };
        }
    }

    private addValidationError(validationError: string | undefined, error: string): string {
        if (validationError === undefined) {
            return error
        } else {
            return validationError + "; " + error;
        }
    }

    validate(data: CsvRow): FailedReadItemsCsv | undefined {

        if(this.rowType === undefined) {
            this.rowType = this.validateColumns(data);
            if(this.rowType === undefined) {
                return { error: "Unexpected schema, check number of column and/or headers" }
            }
        }
        if(!this.isEmpty(data)) {
            const displayId = data['ID'];
            const description = data['DESCRIPTION'];

            let validationError: string | undefined = undefined;
            if(displayId in this.ids) {
                validationError = this.addValidationError(validationError, "Duplicate ID");
            }
            const id = toItemId(displayId);
            if(!id) {
                validationError = this.addValidationError(validationError, "Invalid ID");
            }

            const termsAndConditionsType = data['TERMS_AND_CONDITIONS TYPE'];
            const termsAndConditionsParameters = data['TERMS_AND_CONDITIONS PARAMETERS'];
            try {
                isValidOrThrow(termsAndConditionsType as TermsAndConditionsElementType, termsAndConditionsParameters)
            } catch (e) {
                validationError = this.addValidationError(validationError, String(e));
            }

            const item: CsvItem = {
                id,
                displayId,
                description,
                termsAndConditionsType,
                termsAndConditionsParameters,
                validationError,
            };

            if(this.rowType === CsvRowType.WithFile || this.rowType === CsvRowType.WithFileAndToken) {
                const dataWithFile: RowWithFile = data as RowWithFile;
                const itemWithFile = item as CsvItemWithFile;
                itemWithFile.fileName = dataWithFile['FILE NAME'];
                if (!isValidMime(dataWithFile['FILE CONTENT TYPE'])) {
                    item.validationError = this.addValidationError(item.validationError, "Invalid file content type");
                }
                itemWithFile.fileContentType = dataWithFile['FILE CONTENT TYPE'];
                itemWithFile.fileSize = dataWithFile['FILE SIZE'];
                if(Hash.isValidHexHash(dataWithFile['FILE HASH'])) {
                    itemWithFile.fileHash = Hash.fromHex(dataWithFile['FILE HASH']);
                } else {
                    item.validationError = this.addValidationError(item.validationError, "Invalid file hash");
                }
            }

            if(this.rowType === CsvRowType.WithFileAndToken || this.rowType === CsvRowType.WithToken) {
                const dataWithToken: RowWithToken = data as RowWithToken;
                const itemWithToken = item as CsvItemWithToken;
                if (!isTokenType(dataWithToken['TOKEN TYPE'])) {
                    item.validationError = this.addValidationError(item.validationError, "Invalid token type");
                }
                itemWithToken.tokenType = dataWithToken['TOKEN TYPE'];
                itemWithToken.tokenId = dataWithToken['TOKEN ID'];
                itemWithToken.tokenIssuance = dataWithToken['TOKEN ISSUANCE'];
            }

            if(this.rowType === CsvRowType.WithFileAndToken) {
                const dataWithToken: RowWithFileAndToken = data as RowWithFileAndToken;
                const itemWithToken = item as CsvItemWithFileAndToken;
                itemWithToken.restrictedDelivery = this.isTrue(dataWithToken['RESTRICTED']);
            }

            this.rows.push(item);
            if (item.validationError) {
                let n = this.errors[item.validationError];
                if (n === undefined) {
                    n = 0;
                }
                this.errors[item.validationError] = n + 1
            }

            this.ids[displayId] = null;
        }
    }

    private validateColumns(data: CsvRow): CsvRowType | undefined {
        let detectedType: CsvRowType | undefined;
        let detectedTypeColumns = 0;
        for(const rowType of CSV_ROW_TYPE_VALUES) {
            const columns = columnsByType[rowType];
            const candidateType = this.validateColumnsGivenType(data, columns, rowType);
            if(candidateType !== undefined && columns.length > detectedTypeColumns) {
                detectedType = candidateType;
                detectedTypeColumns = columns.length;
            }
        }
        return detectedType;
    }

    private validateColumnsGivenType(data: CsvRow, expectedKeys: ReadonlyArray<string>, expectedType: CsvRowType): CsvRowType | undefined {
        const keys = Object.keys(data);
        for(const key of expectedKeys) {
            if(!keys.includes(key)) {
                return undefined;
            }
        }
        return expectedType;
    }

    private isEmpty(data: Record<string, string>): boolean {
        const keys = Object.keys(data);
        for(const key of keys) {
            if(data[key]) {
                return false;
            }
        }
        return true;
    }

    private isTrue(value: string): boolean {
        return value.toLowerCase() === "y";
    }
}

