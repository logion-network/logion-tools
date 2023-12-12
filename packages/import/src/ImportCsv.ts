import { Command, Option, InvalidArgumentError } from "commander";
import { ValidateCsv } from "./ValidateCsv.js";
import { CsvItem, toItem } from "@logion/csv";
import { UUID, Hash } from "@logion/node-api";
import { Environment, EnvironmentString, FullSigner, KeyringSigner, ClosedCollectionLoc, Signer } from "@logion/client";
import { newLogionClient } from "@logion/client-node";
import { Keyring } from "@polkadot/api";
import fs from "fs/promises";

export interface CsvImportParams {
    env: EnvironmentString,
    loc: UUID,
    dir: string,
    suri: string,
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

    private createCommand(): Command {
        return new Command("import-csv")
            .addOption(new Option("--env <environment>", "The environment")
                .choices(Object.keys(Environment))
                .makeOptionMandatory()
            )
            .addOption(new Option("--loc <locId>", "The Collection LOC ID (decimal or UUID)")
                .makeOptionMandatory()
                .argParser<UUID>(locIdString => {
                    const locId = UUID.fromAnyString(locIdString);
                    if (locId) {
                        return locId;
                    } else {
                        throw new InvalidArgumentError("Invalid collection LOC ID");
                    }
                })
            )
            .addOption(new Option("--suri <suriPath>", "The path to the Secret key of the account")
                .makeOptionMandatory()
            )
            .addOption(new Option("--dir <dirPath>", "The directory used as input for files"))
            .argument("<csvFiles...>", "the csv files to import")
            .action((csvFiles, csvImportParams) => this.importCsvFiles(csvImportParams, csvFiles))
            .description("To import one or more CSV file(s) into a Collection LOC")
    }

    async importCsvFiles(csvImportParams: CsvImportParams, csvFiles: string []): Promise<void> {

        const anonymousClient = await newLogionClient(csvImportParams.env);

        console.log("Logion Classification %s", anonymousClient.config.logionClassificationLoc);
        console.log("Creative Commons %s", anonymousClient.config.creativeCommonsLoc);

        const { signer, address } = await this.buildSigner(csvImportParams.suri);
        const requesterAccount = anonymousClient.logionApi.queries.getValidAccountId(address, "Polkadot");
        const client = await anonymousClient.authenticate([ requesterAccount ], signer)

        const locsState = await client.locsState({
            spec: {
                requesterAddress: requesterAccount.address,
                locTypes: [ 'Collection' ],
                statuses: [ 'CLOSED' ],
            }
        });
        const collectionLoc = locsState.findById(csvImportParams.loc) as ClosedCollectionLoc;
        const promises = csvFiles.map((csvFile: string) => this.importCsv(collectionLoc, csvFile, signer));
        await Promise.all(promises);
    }

    private async buildSigner(seedPath: string): Promise<{ signer: FullSigner, address: string }> {
        const seed = await fs.readFile(seedPath, { encoding: 'utf8' });
        const keyring = new Keyring({ type: 'sr25519' });
        const { address } = keyring.addFromUri(seed);
        console.log("Polkadot address: %s", address);
        return { signer: new KeyringSigner(keyring), address };
    }

    private async importCsv(collectionLoc: ClosedCollectionLoc, csvFile: string, signer: Signer): Promise<void> {
        const validated = await this.validateCsv.validateCsv(csvFile)
        if (validated) {
            await this.importItems(collectionLoc, validated.items, signer);
            console.log(`${ csvFile } imported`)
        } else {
            console.log(`${ csvFile } skipped`)
        }
    }

    private async importItems(collectionLoc: ClosedCollectionLoc, items: CsvItem[], signer: Signer): Promise<void> {
        for (const item of items) {
            await this.importItem(collectionLoc, item, signer)
        }
    }

    private async importItem(collection: ClosedCollectionLoc, csvItem: CsvItem, signer: Signer): Promise<void> {
        const collectionAcceptsUpload = collection.data().collectionCanUpload !== undefined && collection.data().collectionCanUpload === true;
        const item = toItem(csvItem, collectionAcceptsUpload);
        const existingItem = await collection.getCollectionItem({ itemId: item.id as Hash });
        if (existingItem) {
            console.warn(`Skipping existing item ${ item.displayId }`)
        } else {
            console.log(`Importing new item ${ item.displayId }`)
            await collection.addCollectionItem({
                signer: signer!,
                itemId: item.id!,
                itemDescription: item.description,
                itemFiles: item.files,
                restrictedDelivery: item.restrictedDelivery,
                itemToken: item.token,
                logionClassification: item.logionClassification,
                specificLicenses: item.specificLicense ? [ item.specificLicense ] : undefined,
                creativeCommons: item.creativeCommons,
            })
        }
    }
}
