import { Command, Option, InvalidArgumentError, OptionValues } from "commander";
import { createWriteStream } from "fs";
import * as csv from "fast-csv";
import { Hash } from "@logion/node-api";
import {
    generatePSP34TokenItemId,
    generateEthereumTokenItemId,
    MimeType,
    isValidMime,
    TokenType,
    isTokenType,
    isTokenCompatibleWith,
    TermsAndConditionsElementType,
} from "@logion/client";
import { Row } from "@fast-csv/format/build/src/types";
import { isValidOrThrow } from "./TermsAndConditionsValidator.js";

const TC_TYPES: TermsAndConditionsElementType[] = [ "logion_classification", "specific_license", "CC4.0" ];

export interface RowGenerationParams {
    withFile?: WithFile,
    withToken?: WithToken,
    withTC?: WithTC,
}

export interface CsvGenerationParams extends RowGenerationParams {
    numOfRows: number,
}

export interface WithFile {
    name: string,
    contentType: MimeType
    restricted: boolean,
}

export interface WithToken {
    type: TokenType,
    contractAddress: string,
    nonce: string,
    issuance: number,
}

export interface WithTC {
    type: TermsAndConditionsElementType,
    parameters: string,
}

export class CreateCsv {

    constructor() {
        this._command = this.createCommand();
    }

    private readonly _command: Command;

    get command() {
        return this._command;
    }

    private createCommand(): Command {
        return new Command("create-csv")
            .addOption(new Option("--num-of-rows <number>", "The number of rows").default(1))
            .addOption(new Option("--with-files <mimeType>", "Add files with given mime type, for instance application/pdf or image/png").argParser((mimeType) => {
                if (!isValidMime(mimeType)) {
                    throw new InvalidArgumentError("Invalid mime-type");
                }
                return mimeType;
            }))
            .addOption(new Option("--restricted [boolean]", "To enable file restricted delivery").default(false).preset(true))
            .addOption(new Option("--with-tokens <tokenType>", "Add token with given type").argParser((tokenType => {
                if (!isTokenType(tokenType)) {
                    throw new InvalidArgumentError("Invalid token type");
                }
                return tokenType;
            })))
            .addOption(
                new Option("--contract <address>", "Contract address, if applicable.\nFor Ethereum, use hex prefixed by 0x.\nFor Polkadot, use base58 format.")
                    .default("__CONTRACT__", "\nUses value '__CONTRACT__' if and only if the chosen token type requires a Contract Address ")
            )
            .addOption(new Option("--nonce <nonce>", "The nonce used at contract instantiation.").default("", "empty string"))
            .addOption(new Option("--issuance <issuance>", "Tokens issuance.").default(1))
            .addOption(new Option("--tc-type <type>", "Terms and Conditions type.").choices(TC_TYPES))
            .addOption(new Option("--tc-details <details>", "Terms and Conditions details."))
            .hook('preAction', (command) => {
                const { tcType, tcDetails } = command.opts();
                if (tcType) {
                    if (tcDetails === undefined) {
                        throw new InvalidArgumentError("Missing --tc-details");
                    } else {
                        try {
                            isValidOrThrow(tcType, tcDetails || "")
                        } catch (e) {
                            throw new InvalidArgumentError(`Invalid --tc-details: ${ tcDetails } [${ e }]`)
                        }
                    }
                }
            })
            .action((options) => this.run(this.toParams(options)))
            .description("To scaffold a CSV");
    }

    toParams(options: OptionValues): CsvGenerationParams {
        const params: CsvGenerationParams = {
            numOfRows: options.numOfRows > 1 ? options.numOfRows : 1
        };

        const mimeType = options.withFiles;
        if (mimeType) {
            params.withFile = {
                name: "image",
                contentType: MimeType.from(mimeType),
                restricted: options.restricted,
            };
        }

        const tokenType = options.withTokens;
        if (tokenType) {
            params.withToken = {
                type: tokenType,
                contractAddress: options.contract,
                nonce: options.nonce,
                issuance: options.issuance,
            }
        }

        const tcType = options.tcType;
        if (tcType) {
            params.withTC = {
                type: tcType,
                parameters: options.tcDetails
            }
        }

        return params
    }

    async run(params: CsvGenerationParams) {
        const { numOfRows } = params;
        const csvStream = csv.format({ headers: true });
        const fileStream = createWriteStream("items.csv");
        csvStream.pipe(fileStream);
        let numOfColumns = 0;
        for (let i = 0; i < numOfRows; ++i) {
            const row = this.createRow(params, i);
            numOfColumns = Object.keys(row).length;
            csvStream.write(row);
        }
        csvStream.end();
        console.log(`items.csv generated with ${ numOfRows } row(s) and ${ numOfColumns } columns`)
    }

    createRow(params: RowGenerationParams, i = 0): Row {
        const { withFile, withToken, withTC } = params;
        const itemId = withToken ?
            this.generateItemId(withToken.type, withToken.nonce, i) :
            i.toString();
        let row: Row = {
            ["ID"]: itemId,
            ["DESCRIPTION"]: "description",
            ["TERMS_AND_CONDITIONS TYPE"]: withTC ? withTC.type : "none",
            ["TERMS_AND_CONDITIONS PARAMETERS"]: withTC ? withTC.parameters : "none",
        };
        if (withFile) {
            row = {
                ...row,
                ["FILE NAME"]: `${ withFile.name }.${ withFile.contentType.extensions[0] }`,
                ["FILE CONTENT TYPE"]: withFile.contentType.mimeType,
                ["FILE SIZE"]: 123456,
                ["FILE HASH"]: "0x0000000000000000000000000000000000000000000000000000000000000000",
            }
        }
        if (withFile && withToken) {
            row = {
                ...row,
                ["RESTRICTED"]: withFile.restricted ? "Y" : "N",
            }
        }
        if (withToken) {
            row = {
                ...row,
                ["TOKEN TYPE"]: withToken.type,
                ["TOKEN ID"]: this.generateTokenId(withToken.type, withToken.contractAddress, i),
                ["TOKEN ISSUANCE"]: withToken.issuance,
            }
        }
        return row;
    }

    generateItemId(tokenType: TokenType, nonce: string, i: number): string {
        if (tokenType === undefined) {
            return i.toString();
        } else if (isTokenCompatibleWith(tokenType, "ETHEREUM")) {
            return generateEthereumTokenItemId(nonce, i.toString()).toHex();
        } else if (tokenType.includes("psp34")) {
            return generatePSP34TokenItemId(nonce, { type: "U64", value: i.toString() }).toHex();
        } else {
            return Hash.of(i.toString()).toHex();
        }
    }

    generateTokenId(tokenType: TokenType, contractAddress: string, i: number): string {
        if (isTokenCompatibleWith(tokenType, "ETHEREUM")) {
            return `{"contract":"${ contractAddress }","id":"${ i }"}`
        } else if (tokenType.includes("psp34")) {
            return `{"contract":"${ contractAddress }","id":{"U64":${ i }}}`
        } else {
            return i.toString()
        }
    }
}
