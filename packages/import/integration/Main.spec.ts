import { setupInitialState, State, tearDown, createCollectionLoc, createTransactionLoc } from "./Utils.js";
import { ParseOptions, Command } from "commander";
import { CreateCsv } from "../src/CreateCsv.js";
import { ImportCsv } from "../src/ImportCsv.js";
import { ValidateCsv } from "../src/ValidateCsv.js";
import { ClosedCollectionLoc } from "@logion/client";
import fs from "fs/promises";
import { Hash } from "@logion/node-api";

describe("Logion Tools", () => {

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

    let state: State;

    const workDir = "./integration";
    beforeAll(async () => {
        state = await setupInitialState(workDir);
    });

    const parseOptions: ParseOptions = { from: "user" };

    let command: Command;
    beforeEach(() => {
        const createCsv = new CreateCsv()
        const validateCsv = new ValidateCsv();
        const importCsv = new ImportCsv(validateCsv);
        command = new Command()
            .addCommand(createCsv.command)
            .addCommand(validateCsv.command)
            .addCommand(importCsv.command)
            .exitOverride();
    })

    it("creates the CSV with files, tokens and logion classification", async () => {
        const argv = [
            "create-csv",
            "--with-files", "image/png",
            "--dir", `${ workDir }/images`,
            "--with-tokens", "astar_psp34",
            "--contract", "XXLFQGUoR6uGumo41aP6XpFrpoptvKZU3MBGgFsTbAfr9dw",
            "--issuance", "5",
            "--restricted",
            "--tc-type", "logion_classification",
            "--tc-details", '{"transferredRights": ["PER-PRIV", "WW", "NOTIME"]}',
        ];
        await command.parseAsync(argv, parseOptions);
    })

    it("imports the CSV with files, tokens and logion classification", async () => {
        const client = state.client.withCurrentAccount(state.requesterAccount);
        const logionClassificationLoc = await createTransactionLoc("Logion Classification LOC", state);

        const collectionLoc = await createCollectionLoc("Collection LOC #1", state);
        const argv = [
            "import-csv",
            "--loc", `${ collectionLoc.toDecimalString() }`,
            "--suri", `${ workDir }/suri.txt`,
            "--dir", `${ workDir }/images`,
            "--local",
            "--logionClassificationLoc", `${ logionClassificationLoc!.toDecimalString() }`,
            "items.csv"
        ];
        await command.parseAsync(argv, parseOptions);
        const collection = (await client.locsState()).findById(collectionLoc) as ClosedCollectionLoc;
        await collection.refresh();
        const items = await collection.getCollectionItems();
        expect(items.length).toEqual(10);
        for (const item of items) {
            expect(item.files.length).toEqual(1);
            expect(item.logionClassification?.type).toEqual("logion_classification");
            expect(item.logionClassification?.tcLocId.toString()).toEqual(logionClassificationLoc.toString());

            expect(item.token?.issuance).toEqual(5n);
            expect(item.token?.type.validValue()).toEqual("astar_psp34");

            const transferredRightsCodes = item.logionClassification?.transferredRights().map(tr => tr.code);
            expect(transferredRightsCodes).toContain("PER-PRIV");
            expect(transferredRightsCodes).toContain("WW");
            expect(transferredRightsCodes).toContain("NOTIME");
        }
        // Check one item
        const item5 = items.find(item => item.id.equalTo(Hash.fromHex("0x2e453f19fe91fbdebb169ffab9a8487a0ad9cf167ebc89fcb86656f53b36f4a0")))!;
        expect(item5.token?.id.validValue()).toEqual('{"contract":"XXLFQGUoR6uGumo41aP6XpFrpoptvKZU3MBGgFsTbAfr9dw","id":{"U64":5}}');
        const file = item5.files[0];
        expect(file.name.validValue()).toEqual("img_5.png")
        expect(file.hash.toHex()).toEqual("0x69061dbff1f033e64cd77f2760510823aaccb3f1c3a3887b2204fd8ec42312f3")

    })

    it("creates the CSV with no tokens, no files and creative commons", async () => {
        const argv = [
            "create-csv",
            "--tc-type", "CC4.0",
            "--tc-details", 'BY-NC-SA',
            "--num-of-rows", "17",
        ];
        await command.parseAsync(argv, parseOptions);
    })

    it("imports the CSV with no tokens, no files and creative commons", async () => {
        const client = state.client.withCurrentAccount(state.requesterAccount);
        const creativeCommonsLoc = await createTransactionLoc("Creative Commons LOC", state);

        const collectionLoc = await createCollectionLoc("Collection LOC #2", state);
        const argv = [
            "import-csv",
            "--loc", `${ collectionLoc.toDecimalString() }`,
            "--suri", `${ workDir }/suri.txt`,
            "--local",
            "--batch-size", "12",
            "--creativeCommonsLoc", `${ creativeCommonsLoc!.toDecimalString() }`,
            "items.csv"
        ];
        await command.parseAsync(argv, parseOptions);
        const collection = (await client.locsState()).findById(collectionLoc) as ClosedCollectionLoc;
        await collection.refresh();
        const items = await collection.getCollectionItems();
        expect(items.length).toEqual(17);
        for (const item of items) {
            expect(item.files.length).toEqual(0);
            expect(item.token).toBeUndefined();
            expect(item.creativeCommons?.type).toEqual("CC4.0");
            expect(item.creativeCommons?.tcLocId.toString()).toEqual(creativeCommonsLoc.toString());
            expect(item.creativeCommons?.details).toEqual("BY-NC-SA");
        }
    })

    afterAll(async () => {
        await fs.rm("items.csv", { force: true });
        if (state) {
            tearDown(state);
        }
    })
})
