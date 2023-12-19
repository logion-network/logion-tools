import { ParseOptions, Command } from "commander";
import { ImportCsv, CsvImportParams } from "../src/ImportCsv.js";
import { Mock, It, Times } from "moq.ts";
import { ValidateCsv } from "../src/ValidateCsv.js";
import { ClosedCollectionLoc, Signer, LocData, HashOrContent, MimeType } from "@logion/client";
import { UUID, Hash } from "@logion/node-api";
import { CsvItemWithoutFile, CsvItemWithFile } from "@logion/csv";
import { BlockchainBatchSubmission, AddCollectionItemParams } from "@logion/client/dist/LocClient.js";
import { UploadCollectionItemFileParams } from "@logion/client/dist/Loc.js";
import { CollectionItem as CollectionItemClass } from "@logion/client/dist/CollectionItem.js";
import { NodeFile } from "@logion/client-node";

describe("ImportCsv - command", () => {

    const parseOptions: ParseOptions = { from: "user" };

    let command: Command;
    beforeEach(() => {
        const validateCsv = new Mock<ValidateCsv>;
        const createCsv = new ImportCsv(validateCsv.object());
        command = createCsv.command.exitOverride();
    })

    it("fails on wrong env", () => {
        expect(() => command.parse([ "--env", "WRONG" ], parseOptions))
            .toThrowError("error: option '--env <environment>' argument 'WRONG' is invalid. Allowed choices are DEV, TEST, MVP.")
    })

    it("fails on wrong LOC", () => {
        expect(() => command.parse([ "--loc", "WRONG" ], parseOptions))
            .toThrowError("error: option '--loc <locId>' argument 'WRONG' is invalid. Invalid collection LOC ID")
    })

    it("succeeds with valid options", () => {
        command.parse([ "--loc", "6d5c886a-6350-4041-9205-afc2a67a6938", "--env", "DEV", "--suri", "my-suri", "file1.csv", "file2.csv", "file3.csv" ], parseOptions)
    })
})

describe("ImportCsv - importItems", () => {

    const csvImportParams: CsvImportParams = {
        env: "DEV",
        loc: new UUID("6d5c886a-6350-4041-9205-afc2a67a6938"),
        suri: "my-suri",
        batchSize: 5,
        local: false,
        dir: "./test/resources",
    };
    const signer = new Mock<Signer>().object();

    const csvItemsWithoutFile: CsvItemWithoutFile[] = [
        {
            description: "some-description",
            displayId: "1",
            id: Hash.of("1"),
            termsAndConditionsType: "CC4.0",
            termsAndConditionsParameters: "BY-SA",
        },
        {
            description: "some-other-description",
            displayId: "2",
            id: Hash.of("2"),
            termsAndConditionsType: "CC4.0",
            termsAndConditionsParameters: "BY-SA",
        }
    ];

    let importCsv: ImportCsv
    beforeEach(() => {
        const validateCsv = new Mock<ValidateCsv>;
        importCsv = new ImportCsv(validateCsv.object());
    })

    it("succeeds to add non-existing items without file", async () => {
        const collectionLoc = mockCollectionLoc({ itemsExists: false, collectionCanUpload: false });
        await importCsv.importItems(collectionLoc.object(), csvItemsWithoutFile, signer, csvImportParams)
        collectionLoc.verify(instance => instance.addCollectionItems(It.Is<BlockchainBatchSubmission<AddCollectionItemParams>>(params =>
                params.payload[0].itemId.equalTo(Hash.of("1")) &&
                params.payload[0].itemDescription === "some-description" &&
                params.payload[1].itemId.equalTo(Hash.of("2")) &&
                params.payload[1].itemDescription === "some-other-description"
            )),
            Times.Once()
        );
        collectionLoc.verify(instance => instance.uploadCollectionItemFile(It.IsAny<UploadCollectionItemFileParams>()),
            Times.Never()
        );
    })

    it("succeeds to add non-existing items with file", async () => {
        const collectionLoc = mockCollectionLoc({ itemsExists: false, collectionCanUpload: true });
        const hashOrContent = [
            await getFile(csvImportParams.dir!, "test-0.pdf"),
            await getFile(csvImportParams.dir!, "test-1.pdf"),
        ]
        const csvItems: CsvItemWithFile[] = csvItemsWithoutFile.map((item, index) => ({
            ...item,
            fileName: hashOrContent[index].name,
            fileContentType: hashOrContent[index].mimeType.mimeType,
            fileHash: hashOrContent[index].contentHash,
            fileSize: hashOrContent[index].size.toString(),
        }))
        await importCsv.importItems(collectionLoc.object(), csvItems, signer, csvImportParams)
        collectionLoc.verify(instance => instance.addCollectionItems(It.Is<BlockchainBatchSubmission<AddCollectionItemParams>>(params =>
                params.payload[0].itemId.equalTo(Hash.of("1")) &&
                params.payload[0].itemDescription === "some-description"
            )),
            Times.Once()
        );
        collectionLoc.verify(instance => instance.uploadCollectionItemFile(It.IsAny<UploadCollectionItemFileParams>()),
            Times.Exactly(2)
        );
    })

    it("skips existing items addition", async () => {
        const collectionLoc = mockCollectionLoc({ itemsExists: true, collectionCanUpload: false });
        await importCsv.importItems(collectionLoc.object(), csvItemsWithoutFile, signer, csvImportParams)
        collectionLoc.verify(instance => instance.addCollectionItems(It.IsAny<BlockchainBatchSubmission<AddCollectionItemParams>>()),
            Times.Never()
        );
        collectionLoc.verify(instance => instance.uploadCollectionItemFile(It.IsAny<UploadCollectionItemFileParams>()),
            Times.Never()
        );
    })

    it("skips existing item addition but uploads file", async () => {
        const collectionLoc = mockCollectionLoc({ itemsExists: true, collectionCanUpload: true });
        const hashOrContent = [
            await getFile(csvImportParams.dir!, "test-0.pdf"),
            await getFile(csvImportParams.dir!, "test-1.pdf"),
        ]
        const csvItems: CsvItemWithFile[] = csvItemsWithoutFile.map((item, index) => ({
            ...item,
            fileName: hashOrContent[index].name,
            fileContentType: hashOrContent[index].mimeType.mimeType,
            fileHash: hashOrContent[index].contentHash,
            fileSize: hashOrContent[index].size.toString(),
        }))
        await importCsv.importItems(collectionLoc.object(), csvItems, signer, csvImportParams)
        collectionLoc.verify(instance => instance.addCollectionItems(It.IsAny<BlockchainBatchSubmission<AddCollectionItemParams>>()),
            Times.Never()
        );
        collectionLoc.verify(instance => instance.uploadCollectionItemFile(It.IsAny<UploadCollectionItemFileParams>()),
            Times.Exactly(2)
        );
    })


})

function mockCollectionLoc(params: { itemsExists: boolean, collectionCanUpload: boolean }): Mock<ClosedCollectionLoc> {
    const { itemsExists, collectionCanUpload } = params;
    const collectionLoc = new Mock<ClosedCollectionLoc>();

    const collectionItem = new Mock<CollectionItemClass>();
    if (itemsExists) {
        collectionItem.setup(instance => instance.files.find(It.IsAny())).returns(
            Promise.resolve({ uploaded: false })
        )
    }
    collectionLoc.setup(instance => instance.data()).returns({
        collectionCanUpload
    } as LocData);
    collectionLoc.setup(instance => instance.getCollectionItem(It.IsAny<Hash>())).returns(
        itemsExists ? Promise.resolve(collectionItem.object()) : Promise.resolve(undefined)
    )
    collectionLoc.setup(instance => instance.addCollectionItems(It.IsAny<BlockchainBatchSubmission<AddCollectionItemParams>>())).returns(
        Promise.resolve(collectionLoc.object())
    );
    collectionLoc.setup(instance => instance.uploadCollectionItemFile(It.IsAny<UploadCollectionItemFileParams>())).returns(
        Promise.resolve(collectionLoc.object())
    );
    return collectionLoc
}

async function getFile(dir: string, name: string): Promise<HashOrContent> {
    const nodeFile = new NodeFile(`${ dir }/${ name }`, name, MimeType.from("application/pdf"));
    const hashOrContent = HashOrContent.fromContent(nodeFile);
    await hashOrContent.finalize();
    return hashOrContent
}

