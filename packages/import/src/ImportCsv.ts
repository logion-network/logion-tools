import { Command, Option, InvalidArgumentError } from "commander";
import { ValidateCsv } from "./ValidateCsv.js";
import { CsvItem, toItem, CsvItemWithFile, BatchMaker } from "@logion/csv";
import { UUID, Hash, ValidAccountId } from "@logion/node-api";
import {
    Environment,
    EnvironmentString,
    FullSigner,
    HashOrContent,
    KeyringSigner,
    ClosedCollectionLoc,
    Signer,
    MimeType,
    LogionClient,
    AddCollectionItemParams
} from "@logion/client";
import { newLogionClient, NodeFile, NodeAxiosFileUploader } from "@logion/client-node";
import { Keyring } from "@polkadot/api";
import fs from "fs/promises";

export interface CsvImportParams {
    env: EnvironmentString,
    loc: UUID,
    dir: string | undefined,
    suri: string,
    batchSize: number,
    local: boolean,
    logionClassificationLoc?: UUID | undefined,
    creativeCommonsLoc?: UUID | undefined,
}

export class ImportCsv {

    constructor(validateCsv: ValidateCsv) {
        this._command = this.createCommand();
        this.validateCsv = validateCsv;
    }

    private readonly _command: Command;
    private readonly validateCsv: ValidateCsv;

    get command() {
        return this._command;
    }

    private uuidParser(uuidString: string, errorMessage: string): UUID {
        const uuid = UUID.fromAnyString(uuidString);
        if (uuid) {
            return uuid;
        } else {
            throw new InvalidArgumentError(errorMessage);
        }
    }

    private createCommand(): Command {
        return new Command("import-csv")
            .addOption(new Option("--env <environment>", "The environment")
                .choices(Object.keys(Environment))
                .makeOptionMandatory()
            )
            .addOption(new Option("--loc <locId>", "The Collection LOC ID (decimal or UUID)")
                .makeOptionMandatory()
                .argParser<UUID>(locIdString => this.uuidParser(locIdString, "Invalid collection LOC ID"))
            )
            .addOption(new Option("--suri <suriPath>", "The path to the Secret key of the account")
                .makeOptionMandatory()
            )
            .addOption(new Option("--dir <dirPath>", "The directory used as input for files"))
            .addOption(new Option("--batch-size <batchSize>", "The size of one batch (i.e. numbers of items in one extrinsic")
                .default(10)
                .argParser(parseInt)
            )
            .addOption(new Option("--local", "Connect to local node (--env value ignored)")
                .implies({ env: "DEV" })
            )
            .addOption(new Option("--logionClassificationLoc <locId>", "The Logion Classification LOC ID (decimal or UUID)")
                .argParser<UUID>(locIdString => this.uuidParser(locIdString, "Invalid Logion Classification LOC ID"))
            )
            .addOption(new Option("--creativeCommonsLoc <locId>", "The Creative Commons LOC ID (decimal or UUID)")
                .argParser<UUID>(locIdString => this.uuidParser(locIdString, "Invalid Creative Commons LOC ID"))
            )
            .argument("<csvFiles...>", "the csv files to import")
            .action((csvFiles, csvImportParams) => this.importCsvFiles(csvImportParams, csvFiles))
            .description("To import one or more CSV file(s) into a Collection LOC")
    }

    async importCsvFiles(csvImportParams: CsvImportParams, csvFiles: string []): Promise<void> {

        const anonymousClient = csvImportParams.local ?
            await LogionClient.create({
                buildFileUploader: () => new NodeAxiosFileUploader(),
                directoryEndpoint: "http://localhost:8090",
                rpcEndpoints: [ "ws://127.0.0.1:9944" ],
                logionClassificationLoc: csvImportParams.logionClassificationLoc,
                creativeCommonsLoc: csvImportParams.creativeCommonsLoc,
            }) :
            await newLogionClient(csvImportParams.env);

        console.log("Logion Classification %s", anonymousClient.config.logionClassificationLoc);
        console.log("Creative Commons %s", anonymousClient.config.creativeCommonsLoc);

        const { signer, requesterAccount } = await this.buildSigner(csvImportParams.suri);
        const client = await anonymousClient.authenticate([ requesterAccount ], signer)

        const locsState = await client.locsState({
            spec: {
                requesterAddress: requesterAccount.address,
                locTypes: [ 'Collection' ],
                statuses: [ 'CLOSED' ],
            }
        });
        const collectionLoc = locsState.findById(csvImportParams.loc) as ClosedCollectionLoc;
        for (const csvFile of csvFiles) {
            await this.importCsv(collectionLoc, csvFile, signer, csvImportParams)
        }
        return anonymousClient.disconnect()
    }

    private async buildSigner(seedPath: string): Promise<{ signer: FullSigner, requesterAccount: ValidAccountId }> {
        const seed = await fs.readFile(seedPath, { encoding: 'utf8' });
        const keyring = new Keyring({ type: 'sr25519' });
        const { address } = keyring.addFromUri(seed.trim());
        const requesterAccount = ValidAccountId.polkadot(address)
        console.log("Polkadot address: %s", requesterAccount.address);
        return { signer: new KeyringSigner(keyring), requesterAccount };
    }

    private async importCsv(collectionLoc: ClosedCollectionLoc, csvFile: string, signer: Signer, csvImportParams: CsvImportParams): Promise<void> {
        const validated = await this.validateCsv.validateCsv(csvFile)
        if (validated) {
            await this.importItems(collectionLoc, validated.items, signer, csvImportParams);
            console.log(`${ csvFile } imported`)
        } else {
            console.log(`${ csvFile } skipped`)
        }
    }

    async importItems(collectionLoc: ClosedCollectionLoc, csvItems: CsvItem[], signer: Signer, csvImportParams: CsvImportParams): Promise<void> {
        const { batchSize, dir } = csvImportParams
        const batchMaker = new BatchMaker(csvItems, batchSize);
        for (let i = 0; i < batchMaker.numOfBatches ; i++) {
            const batch = batchMaker.getBatch(i);
            console.log(`Importing batch ${ i + 1 } / ${ batchMaker.numOfBatches } (${ batch.length } rows)`)
            await this.importItemBatch(collectionLoc, batch, signer, dir)
        }
    }

    private async importItemBatch(collection: ClosedCollectionLoc, csvItems: CsvItem[], signer: Signer, dir: string | undefined): Promise<void> {
        const { collectionParams } = collection.data();
        const collectionAcceptsUpload = collectionParams !== undefined && collectionParams.canUpload;
        const payload: AddCollectionItemParams[] = [];
        const items = csvItems.map(csvItem => toItem(csvItem, collectionAcceptsUpload));

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const existingItem = await collection.getCollectionItem({ itemId: item.id as Hash });
            if (existingItem) {
                console.warn(`Skipping existing item ${ item.displayId }`)
                if (item.upload) {
                    const csvItem = csvItems[i] as CsvItemWithFile;
                    const file = existingItem.files.find(file => file.hash.equalTo(csvItem.fileHash));
                    if (file) {
                        if (file.uploaded) {
                            items[i] = {
                                ...item,
                                upload: false
                            }
                        } else {
                            console.warn(`File not uploaded yet.`)
                        }
                    } else {
                        throw Error("Item exists without file entry")
                    }
                }

            } else {
                console.log(`Importing new item ${ item.displayId }`)
                payload.push( {
                    itemId: item.id!,
                    itemDescription: item.description,
                    itemFiles: item.files,
                    restrictedDelivery: item.restrictedDelivery,
                    itemToken: item.token,
                    logionClassification: item.logionClassification,
                    specificLicenses: item.specificLicense ? [ item.specificLicense ] : undefined,
                    creativeCommons: item.creativeCommons,
                });
            }
        }

        if (payload.length > 0) {
            await collection.addCollectionItems({ signer, payload });
        }

        if (dir) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.upload) {
                    const csvItem = csvItems[i] as CsvItemWithFile;
                    console.log(`Uploading ${ csvItem.fileName } linked to ${ item.displayId }`)
                    await this.uploadItemFile(collection, item.id!, csvItem, dir);
                }
            }
        }
    }

    private async uploadItemFile(collection: ClosedCollectionLoc, itemId: Hash, csvItem: CsvItemWithFile, dir: string): Promise<void> {
        const hashOrContent = HashOrContent.fromContent(new NodeFile(`${ dir }/${ csvItem.fileName }`, csvItem.fileName, MimeType.from(csvItem.fileContentType)));
        await hashOrContent.finalize();
        if (hashOrContent.contentHash.equalTo(csvItem.fileHash)) {
            await collection.uploadCollectionItemFile({
                itemId,
                itemFile: hashOrContent
            })
        } else {
            console.warn(`File not uploaded due to Hash mismatch: from CSV: ${ csvItem.fileHash.toHex() } vs calculated: ${ hashOrContent.contentHash.toHex() }`)
        }
    }
}
