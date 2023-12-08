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
    HashAndSize,
    TERMS_AND_CONDITIONS_TYPES,
} from "@logion/client";
import { Row } from "@fast-csv/format/build/src/types";
import { isValidOrThrow } from "@logion/csv";
import fs from "fs";
import { NodeFile } from "@logion/client-node";

export interface RowGenerationParams {
    withFile?: WithFile,
    withToken?: WithToken,
    withTC?: WithTC,
}

export interface CsvGenerationParams extends RowGenerationParams {
    numOfRows?: number,
}

export interface WithFile {
    dir: string | undefined,
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

interface File {
    name: string;
    mimeType: MimeType;
    getHashAndSize(): Promise<HashAndSize>;
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
            .addOption(new Option("--num-of-rows <number>", "The number of rows"))
            .addOption(new Option("--with-files <mimeType>", "Add files with given mime type, for instance application/pdf or image/png").argParser((mimeType) => {
                if (!isValidMime(mimeType)) {
                    throw new InvalidArgumentError("Invalid mime-type");
                }
                return mimeType;
            }))
            .addOption(new Option("--restricted [boolean]", "To enable file restricted delivery").default(false).preset(true))
            .addOption(new Option("--dir <dirPath>", "The directory used as input for files"))
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
            .addOption(new Option("--tc-type <type>", "Terms and Conditions type.").choices(TERMS_AND_CONDITIONS_TYPES))
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
            .hook('preAction', (command) => {
                const { numOfRows, dir } = command.opts();
                if (numOfRows !== undefined && dir !== undefined) {
                    throw new InvalidArgumentError(`Invalid --num-of-rows and --dir are mutually exclusive`)
                }
            })
            .action((options) => this.run(this.toParams(options)))
            .description("To scaffold or create a CSV");
    }

    toParams(options: OptionValues): CsvGenerationParams {
        const params: CsvGenerationParams = {
            numOfRows: options.numOfRows && options.numOfRows > 1 ? options.numOfRows : undefined
        };

        const mimeType = options.withFiles;
        if (mimeType) {
            params.withFile = {
                dir: options.dir,
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
        const csvStream = csv.format({ headers: true });
        const fileStream = createWriteStream("items.csv");
        csvStream.pipe(fileStream);
        await this.generateCsv(params, (row) => csvStream.write(row))
        csvStream.end();
    }

    async generateCsv(params: CsvGenerationParams, writer: (row: Row) => void) {
        const { withFile } = params;
        let numOfRows:number = params.numOfRows ? params.numOfRows : 1;
        let numOfColumns = 0;
        let filesNames: string[] | undefined = undefined;
        if (withFile && withFile.dir) {
            filesNames = this.readFileNames(withFile.dir, withFile.contentType);
            numOfRows = filesNames.length;
        }
        for (let i = 0; i < numOfRows; ++i) {
            let file: File | undefined = undefined;
            if (withFile) {
                file = filesNames ?
                    await this.readFile(withFile, filesNames[i]) :
                    this.scaffold(withFile.contentType, i)
            }
            const row = await this.createRow(params, file, i);
            writer(row);
            numOfColumns = Object.keys(row).length;
        }
        console.log(`items.csv generated with ${ numOfRows } row(s) and ${ numOfColumns } columns`)
    }

    readFileNames(dir: string, mimeType: MimeType): string[] {
        return fs.readdirSync(dir).filter(file => {
            const ext = file.substring(file.lastIndexOf(".") + 1).toLowerCase();
            if (!mimeType.extensions.includes(ext)) {
                console.warn(`Skipping file ${ file }: Invalid extension for ${ mimeType.mimeType }`);
                return false;
            } else {
                return true;
            }
        }).sort();
    }

    async readFile(withFile: WithFile, name: string): Promise<File> {
        const path = `${ withFile.dir }/${ name }`;
        return new NodeFile(path, name, withFile.contentType);
    }

    scaffold(contentType: MimeType, i: number): File {
        return {
            name: `file${ i }.${ contentType.extensions[0] }`,
            mimeType: contentType,
            getHashAndSize(): Promise<HashAndSize> {
                return Promise.resolve({
                    size: 123456n,
                    hash: Hash.fromHex("0x0000000000000000000000000000000000000000000000000000000000000000"),
                })
            }
        }
    }

    async createRow(params: RowGenerationParams, file?: File, i = 0): Promise<Row> {
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
        if (file) {
            const hashAndSize = await file.getHashAndSize();
            row = {
                ...row,
                ["FILE NAME"]: `${ file.name }`,
                ["FILE CONTENT TYPE"]: file.mimeType.mimeType,
                ["FILE SIZE"]: `${ hashAndSize.size }`,
                ["FILE HASH"]: `${ hashAndSize.hash.toHex() }`,
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
