import { Hash } from "@logion/node-api";
import { CsvItemWithFile, CsvItemWithFileAndToken, CsvItemWithToken, CsvRowType } from "@logion/csv";
import { ValidateCsv } from "../src/ValidateCsv.js";
import { Readable } from "stream";
import { ParseOptions, Command } from "commander";

describe("ValidateCsv - command", () => {

    const parseOptions: ParseOptions = { from: "user" };

    let command: Command;
    beforeEach(() => {
        const validateCsv = new ValidateCsv();
        command = validateCsv.command.exitOverride();
    })

    it("fails with no args", () => {
        expect(() => command.parse([ ], parseOptions))
            .toThrowError("error: missing required argument 'csvFiles'")
    })

    it("parses multiple args", () => {
        command.parse([ "csv1.csv", "csv2.csv" ], parseOptions);
    })
})

const CSV_WITHOUT_FILE = `ID,DESCRIPTION,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS
1,An NFT ID,none,none
2,Another NFT ID,none,none,
`;

const CSV_WITHOUT_FILE_EMPTY_ROWS = `ID,DESCRIPTION,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS
1,An NFT ID,TYPE2,PARAM2

2,Another NFT ID,,
`;


const CSV_WITHOUT_FILE_WRONG_NO_HEADER = `1,An NFT ID
2,Another NFT ID
`;

const CSV_WITHOUT_FILE_WRONG_BAD_HEADER = `ID,DESCRIPTIONS
1,An NFT ID
2,Another NFT ID
`;

const CSV_WITH_FILE = `ID,DESCRIPTION,FILE NAME,FILE CONTENT TYPE,FILE SIZE,FILE HASH,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS
programming_music.jpg,Programming Music,programming_music.jpg,image/jpeg,90718,0xa025ca5f086f3b6df1ca96c235c4daff57083bbd4c9320a3013e787849f9fffa,CC4.0,BY
lucas_games_characters.jpg,LucasArts Games Characters,lucas_games_characters.jpg,image/jpeg,91880,0x546b3a31d340681f4c80d84ab317bbd85870e340d3c2feb24d0aceddf6f2fd31,CC4.0,BY-NC
`;

const CSV_WITH_FILE_AND_TOKEN = `ID,DESCRIPTION,FILE NAME,FILE CONTENT TYPE,FILE SIZE,FILE HASH,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS,RESTRICTED,TOKEN TYPE,TOKEN ID,TOKEN ISSUANCE
programming_music.jpg,Programming Music,programming_music.jpg,image/jpeg,90718,0xa025ca5f086f3b6df1ca96c235c4daff57083bbd4c9320a3013e787849f9fffa,CC4.0,BY,Y,owner,0x900edc98db53508e6742723988b872dd08cd09c2,1
lucas_games_characters.jpg,LucasArts Games Characters,lucas_games_characters.jpg,image/jpeg,91880,0x546b3a31d340681f4c80d84ab317bbd85870e340d3c2feb24d0aceddf6f2fd31,CC4.0,BY-NC,Y,owner,0x900edc98db53508e6742723988b872dd08cd09c2,1
`;

const CSV_WITH_TOKEN = `ID,DESCRIPTION,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS,TOKEN TYPE,TOKEN ID,TOKEN ISSUANCE
programming_music.jpg,Programming Music,CC4.0,BY,owner,0x900edc98db53508e6742723988b872dd08cd09c2,1
lucas_games_characters.jpg,LucasArts Games Characters,CC4.0,BY-NC,owner,0x900edc98db53508e6742723988b872dd08cd09c2,1
`;

const CSV_WITH_FILE_WRONG_TYPE = `ID,DESCRIPTION,FILE NAME,FILE CONTENT TYPE,FILE SIZE,FILE HASH,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS
programming_music.jpg,Programming Music,programming_music.jpg,wrong/type,90718,0xa025ca5f086f3b6df1ca96c235c4daff57083bbd4c9320a3013e787849f9fffa,CC4.0,BY
lucas_games_characters.jpg,LucasArts Games Characters,lucas_games_characters.jpg,wrong/type,91880,0x546b3a31d340681f4c80d84ab317bbd85870e340d3c2feb24d0aceddf6f2fd31,CC4.0,BY-NC
`;

const CSV_WITH_TOKEN_WRONG_TYPE = `ID,DESCRIPTION,TERMS_AND_CONDITIONS TYPE,TERMS_AND_CONDITIONS PARAMETERS,TOKEN TYPE,TOKEN ID,TOKEN ISSUANCE
programming_music.jpg,Programming Music,CC4.0,BY,wrongType,0x900edc98db53508e6742723988b872dd08cd09c2,1
lucas_games_characters.jpg,LucasArts Games Characters,CC4.0,BY-NC,wrongType,0x900edc98db53508e6742723988b872dd08cd09c2,1
`;



describe("ValidateCsv - readItemsCsv", () => {

    let validateCsv: ValidateCsv;
    beforeEach(() => {
        validateCsv = new ValidateCsv();
    })

    it("reads items without file", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITHOUT_FILE));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(true);
            expect(result.rowType).toBe(CsvRowType.WithoutFile);
            const items = result.items;
            expect(items.length).toBe(2);

            expect(items[0].displayId).toBe("1");
            expect(items[0].id).toEqual(Hash.of("1"));
            expect(items[0].description).toBe("An NFT ID");
            expect(items[0].termsAndConditionsType).toBe("none");
            expect(items[0].termsAndConditionsParameters).toBe("none");
            expect(items[0].validationError).toBeUndefined();

            expect(items[1].displayId).toBe("2");
            expect(items[1].id).toEqual(Hash.of("2"));
            expect(items[1].description).toBe("Another NFT ID");
            expect(items[1].termsAndConditionsType).toBe("none");
            expect(items[1].termsAndConditionsParameters).toBe("none");
            expect(items[1].validationError).toBeUndefined();
        } else {
            fail("items expected in result");
        }
    });

    it("reads items without file and empty rows", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITHOUT_FILE_EMPTY_ROWS));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(false);
            expect(result.rowType).toBe(CsvRowType.WithoutFile);
            expect(result.errorSummary).toEqual({
                "Error: Unknown T&C type: TYPE2": 1,
                "Error: Unknown T&C type: ": 1,
            })
            const items = result.items;
            expect(items.length).toBe(2);
        } else {
            fail("items expected in result");
        }
    });

    it("reads items with file", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITH_FILE));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(true);
            expect(result.rowType).toBe(CsvRowType.WithFile);
            const items = result.items as CsvItemWithFile[];
            expect(items.length).toBe(2);

            expect(items[0].displayId).toBe("programming_music.jpg");
            expect(items[0].id).toEqual(Hash.of("programming_music.jpg"));
            expect(items[0].description).toBe("Programming Music");
            expect(items[0].fileName).toBe("programming_music.jpg");
            expect(items[0].fileContentType).toBe("image/jpeg");
            expect(items[0].fileSize).toBe("90718");
            expect(items[0].fileHash).toEqual(Hash.fromHex("0xa025ca5f086f3b6df1ca96c235c4daff57083bbd4c9320a3013e787849f9fffa"));
            expect(items[0].termsAndConditionsType).toBe("CC4.0");
            expect(items[0].termsAndConditionsParameters).toBe("BY");

            expect(items[1].displayId).toBe("lucas_games_characters.jpg");
            expect(items[1].id).toEqual(Hash.of("lucas_games_characters.jpg"));
            expect(items[1].description).toBe("LucasArts Games Characters");
            expect(items[1].fileName).toBe("lucas_games_characters.jpg");
            expect(items[1].fileContentType).toBe("image/jpeg");
            expect(items[1].fileSize).toBe("91880");
            expect(items[1].fileHash).toEqual(Hash.fromHex("0x546b3a31d340681f4c80d84ab317bbd85870e340d3c2feb24d0aceddf6f2fd31"));
            expect(items[1].termsAndConditionsType).toBe("CC4.0");
            expect(items[1].termsAndConditionsParameters).toBe("BY-NC");
        } else {
            fail("items expected in result");
        }
    });

    it("reads items with file and token", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITH_FILE_AND_TOKEN));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(true);
            expect(result.rowType).toBe(CsvRowType.WithFileAndToken);
            const items = result.items as CsvItemWithFileAndToken[];
            expect(items.length).toBe(2);

            expect(items[0].displayId).toBe("programming_music.jpg");
            expect(items[0].id).toEqual(Hash.of("programming_music.jpg"));
            expect(items[0].description).toBe("Programming Music");
            expect(items[0].fileName).toBe("programming_music.jpg");
            expect(items[0].fileContentType).toBe("image/jpeg");
            expect(items[0].fileSize).toBe("90718");
            expect(items[0].fileHash).toEqual(Hash.fromHex("0xa025ca5f086f3b6df1ca96c235c4daff57083bbd4c9320a3013e787849f9fffa"));
            expect(items[0].termsAndConditionsType).toBe("CC4.0");
            expect(items[0].termsAndConditionsParameters).toBe("BY");
            expect(items[0].restrictedDelivery).toBe(true);
            expect(items[0].tokenType).toBe("owner");
            expect(items[0].tokenId).toBe("0x900edc98db53508e6742723988b872dd08cd09c2");

            expect(items[1].displayId).toBe("lucas_games_characters.jpg");
            expect(items[1].id).toEqual(Hash.of("lucas_games_characters.jpg"));
            expect(items[1].description).toBe("LucasArts Games Characters");
            expect(items[1].fileName).toBe("lucas_games_characters.jpg");
            expect(items[1].fileContentType).toBe("image/jpeg");
            expect(items[1].fileSize).toBe("91880");
            expect(items[1].fileHash).toEqual(Hash.fromHex("0x546b3a31d340681f4c80d84ab317bbd85870e340d3c2feb24d0aceddf6f2fd31"));
            expect(items[1].termsAndConditionsType).toBe("CC4.0");
            expect(items[1].termsAndConditionsParameters).toBe("BY-NC");
            expect(items[1].restrictedDelivery).toBe(true);
            expect(items[1].tokenType).toBe("owner");
            expect(items[1].tokenId).toBe("0x900edc98db53508e6742723988b872dd08cd09c2");
        } else {
            fail("items expected in result");
        }
    });

    it("reads items with token", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITH_TOKEN));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(true);
            expect(result.rowType).toBe(CsvRowType.WithToken);
            const items = result.items as CsvItemWithToken[];
            expect(items.length).toBe(2);

            expect(items[0].displayId).toBe("programming_music.jpg");
            expect(items[0].id).toEqual(Hash.of("programming_music.jpg"));
            expect(items[0].description).toBe("Programming Music");
            expect(items[0].termsAndConditionsType).toBe("CC4.0");
            expect(items[0].termsAndConditionsParameters).toBe("BY");
            expect(items[0].tokenType).toBe("owner");
            expect(items[0].tokenId).toBe("0x900edc98db53508e6742723988b872dd08cd09c2");

            expect(items[1].displayId).toBe("lucas_games_characters.jpg");
            expect(items[1].id).toEqual(Hash.of("lucas_games_characters.jpg"));
            expect(items[1].description).toBe("LucasArts Games Characters");
            expect(items[1].termsAndConditionsType).toBe("CC4.0");
            expect(items[1].termsAndConditionsParameters).toBe("BY-NC");
            expect(items[1].tokenType).toBe("owner");
            expect(items[1].tokenId).toBe("0x900edc98db53508e6742723988b872dd08cd09c2");
        } else {
            fail("items expected in result");
        }
    });

    it("detects wrong CSV without header", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITHOUT_FILE_WRONG_NO_HEADER));
        if("error" in result) {
            expect(result.error).toBe("Unexpected schema, check number of column and/or headers");
        } else {
            fail();
        }
    });

    it("detects wrong CSV with bad headers", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITHOUT_FILE_WRONG_BAD_HEADER));
        if("error" in result) {
            expect(result.error).toBe("Unexpected schema, check number of column and/or headers");
        } else {
            fail();
        }
    });

    it("reads items with file with wrong type", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITH_FILE_WRONG_TYPE));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(false);
            expect(result.rowType).toBe(CsvRowType.WithFile);
            expect(result.errorSummary).toEqual({
                "Invalid file content type": 2,
            });

            const items = result.items as CsvItemWithFile[];
            expect(items.length).toBe(2);

            expect(items[0].displayId).toBe("programming_music.jpg");
            expect(items[0].id).toEqual(Hash.of("programming_music.jpg"));
            expect(items[0].description).toBe("Programming Music");
            expect(items[0].fileName).toBe("programming_music.jpg");
            expect(items[0].fileContentType).toBe("wrong/type");
            expect(items[0].fileSize).toBe("90718");
            expect(items[0].fileHash).toEqual(Hash.fromHex("0xa025ca5f086f3b6df1ca96c235c4daff57083bbd4c9320a3013e787849f9fffa"));
            expect(items[0].termsAndConditionsType).toBe("CC4.0");
            expect(items[0].termsAndConditionsParameters).toBe("BY");

            expect(items[1].displayId).toBe("lucas_games_characters.jpg");
            expect(items[1].id).toEqual(Hash.of("lucas_games_characters.jpg"));
            expect(items[1].description).toBe("LucasArts Games Characters");
            expect(items[1].fileName).toBe("lucas_games_characters.jpg");
            expect(items[1].fileContentType).toBe("wrong/type");
            expect(items[1].fileSize).toBe("91880");
            expect(items[1].fileHash).toEqual(Hash.fromHex("0x546b3a31d340681f4c80d84ab317bbd85870e340d3c2feb24d0aceddf6f2fd31"));
            expect(items[1].termsAndConditionsType).toBe("CC4.0");
            expect(items[1].termsAndConditionsParameters).toBe("BY-NC");
        } else {
            fail("items expected in result");
        }
    });

    it("reads items with token with wrong token", async () => {
        const result = await validateCsv.readItemsCsv(Readable.from(CSV_WITH_TOKEN_WRONG_TYPE));
        if("items" in result) {
            expect(result.fullyValidated).toEqual(false);
            expect(result.rowType).toBe(CsvRowType.WithToken);
            expect(result.errorSummary).toEqual({
                "Invalid token type": 2,
            });

            const items = result.items as CsvItemWithToken[];
            expect(items.length).toBe(2);

            expect(items[0].displayId).toBe("programming_music.jpg");
            expect(items[0].id).toEqual(Hash.of("programming_music.jpg"));
            expect(items[0].description).toBe("Programming Music");
            expect(items[0].termsAndConditionsType).toBe("CC4.0");
            expect(items[0].termsAndConditionsParameters).toBe("BY");
            expect(items[0].tokenType).toBe("wrongType");
            expect(items[0].tokenId).toBe("0x900edc98db53508e6742723988b872dd08cd09c2");

            expect(items[1].displayId).toBe("lucas_games_characters.jpg");
            expect(items[1].id).toEqual(Hash.of("lucas_games_characters.jpg"));
            expect(items[1].description).toBe("LucasArts Games Characters");
            expect(items[1].termsAndConditionsType).toBe("CC4.0");
            expect(items[1].termsAndConditionsParameters).toBe("BY-NC");
            expect(items[1].tokenType).toBe("wrongType");
            expect(items[1].tokenId).toBe("0x900edc98db53508e6742723988b872dd08cd09c2");
        } else {
            fail("items expected in result");
        }
    });
});
