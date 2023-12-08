import { CreateCsv, WithFile, WithToken, WithTC } from "../src/CreateCsv.js";
import { ParseOptions, Command } from "commander";
import { Row, RowMap } from "@fast-csv/format/build/src/types";
import { MimeType } from "@logion/client";
import { COLUMNS_WITHOUT_FILE, COLUMNS_WITH_FILE, COLUMNS_WITH_TOKEN, COLUMNS_WITH_FILE_AND_TOKEN } from "@logion/csv";

describe("CreateCsv - command", () => {

    const parseOptions: ParseOptions = { from: "user" };

    let command: Command;
    beforeEach(() => {
        const createCsv = new CreateCsv();
        command = createCsv.command.exitOverride();
    })

    it("fails on wrong mime-type", () => {
        expect(() => command.parse([ "--with-files", "yyyyy/zzzz" ], parseOptions))
            .toThrowError("error: option '--with-files <mimeType>' argument 'yyyyy/zzzz' is invalid. Invalid mime-type")
    })

    it("fails on wrong tc-type", () => {
        expect(() => command.parse([ "--tc-type", "Unknown", "--tc-details", "Unknown" ], parseOptions))
            .toThrowError("error: option '--tc-type <type>' argument 'Unknown' is invalid. Allowed choices are logion_classification, specific_license, CC4.0.")
    })

    it("fails on wrong tc-details for CC4.0", () => {
        expect(() => command.parse([ "--tc-type", "CC4.0", "--tc-details", "Unknown" ], parseOptions))
            .toThrowError("Invalid --tc-details: Unknown [Error: Invalid parameters: Unknown. Valid values are: BY,BY-SA,BY-NC,BY-NC-SA,BY-ND,BY-NC-ND.]")
    })

    it("succeeds with tc CC4.0", () => {
        command.parse([ "--tc-type", "CC4.0", "--tc-details", "BY-SA" ], parseOptions);
    })

    it("fails on wrong tc-details for logion_classification", () => {
        expect(() => command.parse([ "--tc-type", "logion_classification", "--tc-details", '{ "transferredRights": [ "PER-PUB", "REG" ], "regionalLimit": ["BE", "NOWHERE", "SomeWhereElse"] }' ], parseOptions))
            .toThrowError('Invalid --tc-details: { "transferredRights": [ "PER-PUB", "REG" ], "regionalLimit": ["BE", "NOWHERE", "SomeWhereElse"] } [Error: Unknown Country code(s): NOWHERE,SomeWhereElse]')
    })

    it("succeeds with tc logion_classification", () => {
        command.parse([ "--tc-type", "logion_classification", "--tc-details", '{"transferredRights":["PER-PRIV","REG","TIME"],"regionalLimit":["BE","FR","US"],"expiration":"2022-09-23"}' ], parseOptions);
    })

    it("fails on wrong tc-details for specific_license", () => {
        expect(() => command.parse([ "--tc-type", "specific_license", "--tc-details", "ABC" ], parseOptions))
            .toThrowError('Invalid --tc-details: ABC [Error: specific_license: invalid LOC ID: ABC]')
    })

    it("succeeds with tc specific_license", () => {
        command.parse([ "--tc-type", "specific_license", "--tc-details", "8d24cca4-1031-43cd-9a57-65ff74eaf556" ], parseOptions);
    })

    it("fails with wrong token", () => {
        expect(() => command.parse([ "--with-tokens", "Unknown" ], parseOptions))
            .toThrowError("error: option '--with-tokens <tokenType>' argument 'Unknown' is invalid. Invalid token type")
    })

    it("succeeds with no option", () => {
        command.parse([ "create-csv" ], parseOptions);
    })

    it("fails if --num-of-rows and --dir are combined", () => {
        expect(() => command.parse([ "--num-of-rows", "10", "--dir", "some-dir" ], parseOptions))
            .toThrowError("Invalid --num-of-rows and --dir are mutually exclusive")
    })
})

describe("CreateCsv - CSV output ", () => {

    function withFile(restricted: boolean, dir?: string): WithFile {
        return {
            dir,
            contentType: MimeType.from("image/png"),
            restricted,
        }
    }

    const withToken: WithToken = {
        type: "astar_psp34",
        nonce: "",
        issuance: 1,
        contractAddress: "ABC",
    };

    const withTC: WithTC = {
        type: "logion_classification",
        parameters: '{"transferredRights":["PER-PRIV","REG","TIME"],"regionalLimit":["BE","FR","US"],"expiration":"2022-09-23"}'
    }

    let createCsv = new CreateCsv();
    const file = createCsv.scaffold(MimeType.from("image/png"), 0);

    it("works Without File", async () => {
        const row = await createCsv.createRow({});
        checkKeys(row, COLUMNS_WITHOUT_FILE);
        checkCommonColumns(row, "0");
    })

    it("works With File", async () => {
        const row = await createCsv.createRow({ withFile: withFile(false) }, file);
        checkKeys(row, COLUMNS_WITH_FILE);
        checkCommonColumns(row, "0");
        checkFileColumns(row);
    })

    it("works With Token", async () => {
        const row = await createCsv.createRow({ withToken })
        checkKeys(row, COLUMNS_WITH_TOKEN);
        checkCommonColumns(row, "0xfd8e45608baccf004189a794eee8947ad095dd561e0981fcae90309fac5cf8fe");
        checkTokenColumns(row);
    })

    it("works With restricted delivery File And Token", async () => {
        const row = await createCsv.createRow({ withFile: withFile(true), withToken, withTC }, file)
        checkKeys(row, COLUMNS_WITH_FILE_AND_TOKEN);
        checkCommonColumns(row, "0xfd8e45608baccf004189a794eee8947ad095dd561e0981fcae90309fac5cf8fe", withTC);
        checkFileColumns(row, { restricted: "Y" });
        checkTokenColumns(row);
    })

    it("works With File And Token", async () => {
        const row = await createCsv.createRow({ withFile: withFile(false), withToken, withTC }, file)
        checkKeys(row, COLUMNS_WITH_FILE_AND_TOKEN);
        checkCommonColumns(row, "0xfd8e45608baccf004189a794eee8947ad095dd561e0981fcae90309fac5cf8fe", withTC);
        checkFileColumns(row, { restricted: "N" });
        checkTokenColumns(row);
    })

    it("generates CSV from directory", async () => {
        const rows: RowMap[] = [];
        await createCsv.generateCsv(
            {
                withFile: {
                    contentType: MimeType.from("application/pdf"),
                    dir: "./test/resources",
                    restricted: true,
                },
                withToken,
                withTC
            }, (row) => rows.push(row))
        expect(rows.length).toEqual(3)
        expect(rows[0]['FILE NAME']).toEqual("test-0.pdf")
        expect(rows[0]['FILE SIZE']).toEqual("7141")
        expect(rows[0]['FILE HASH']).toEqual("0xec856a2ae05cfcc8f103762d48352104fa8bd51cced6b1be9afba67c338c291d")
        expect(rows[1]['FILE NAME']).toEqual("test-1.pdf")
        expect(rows[1]['FILE SIZE']).toEqual("7111")
        expect(rows[1]['FILE HASH']).toEqual("0xd0e9ebe4c7a35d94d4be2d9d3206c59a51b3c1e8c7c80922ac1ca3bacd29df6a")
        expect(rows[2]['FILE NAME']).toEqual("test-2.pdf")
        expect(rows[2]['FILE SIZE']).toEqual("7157")
        expect(rows[2]['FILE HASH']).toEqual("0x451f94644093755a8b77676cf9453315a3984c69dbd04352d5f88238b452f7f0")
    })

    function checkKeys(row: Row, keys: readonly string[]) {
        expect(Object.keys(row)).toEqual(keys);
    }

    function checkCommonColumns(row: Row, expectedId: string, withTC?: WithTC) {
        const rowMap = row as RowMap;
        expect(rowMap['ID']).toEqual(expectedId);
        expect(rowMap['DESCRIPTION']).toEqual('description');
        if (withTC) {
            expect(rowMap['TERMS_AND_CONDITIONS TYPE']).toEqual(withTC.type);
            expect(rowMap['TERMS_AND_CONDITIONS PARAMETERS']).toEqual(withTC.parameters);
        } else {
            expect(rowMap['TERMS_AND_CONDITIONS TYPE']).toEqual('none');
            expect(rowMap['TERMS_AND_CONDITIONS PARAMETERS']).toEqual('none');
        }
    }

    function checkFileColumns(row: Row, withRestricted?: { restricted: string }) {
        const rowMap = row as RowMap;
        expect(rowMap['FILE NAME']).toEqual('file0.png');
        expect(rowMap['FILE CONTENT TYPE']).toEqual('image/png');
        expect(rowMap['FILE SIZE']).toEqual("123456");
        expect(rowMap['FILE HASH']).toEqual('0x0000000000000000000000000000000000000000000000000000000000000000');
        if (withRestricted) {
            expect(rowMap['RESTRICTED']).toEqual(withRestricted.restricted);
        }
    }

    function checkTokenColumns(row: Row) {
        const rowMap = row as RowMap;
        expect(rowMap['TOKEN TYPE']).toEqual('astar_psp34');
        expect(rowMap['TOKEN ID']).toEqual('{"contract":"ABC","id":{"U64":0}}');
        expect(rowMap['TOKEN ISSUANCE']).toEqual(1);
    }
})
