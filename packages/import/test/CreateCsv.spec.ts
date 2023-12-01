import { CreateCsv, WithFile, WithToken, WithTC } from "../src/CreateCsv.js";
import { ParseOptions, Command } from "commander";
import { Row, RowMap } from "@fast-csv/format/build/src/types";
import { MimeType } from "@logion/client";

describe("CreateCsv - command - ", () => {

    const parseOptions: ParseOptions = { from: "user" };

    let command: Command;
    beforeEach(() => {
        const createCsv = new CreateCsv();
        command = createCsv.command.exitOverride();
    })

    it("fails on wrong mime-type", () => {
        expect(() => command.parse([ "create-csv", "--with-files", "yyyyy/zzzz" ], parseOptions))
            .toThrowError("error: option '--with-files <mimeType>' argument 'yyyyy/zzzz' is invalid. Invalid mime-type")
    })

    it("fails on wrong tc-type", () => {
        expect(() => command.parse([ "create-csv", "--tc-type", "Unknown", "--tc-details", "Unknown" ], parseOptions))
            .toThrowError("error: option '--tc-type <type>' argument 'Unknown' is invalid. Allowed choices are logion_classification, specific_license, CC4.0.")
    })

    it("fails on wrong tc-details for CC4.0", () => {
        expect(() => command.parse([ "create-csv", "--tc-type", "CC4.0", "--tc-details", "Unknown" ], parseOptions))
            .toThrowError("Invalid --tc-details: Unknown [Error: Invalid parameters: Unknown. Valid values are: BY,BY-SA,BY-NC,BY-NC-SA,BY-ND,BY-NC-ND.]")
    })

    it("succeeds with tc CC4.0", () => {
        command.parse([ "create-csv", "--tc-type", "CC4.0", "--tc-details", "BY-SA" ], parseOptions);
    })

    it("fails on wrong tc-details for logion_classification", () => {
        expect(() => command.parse([ "create-csv", "--tc-type", "logion_classification", "--tc-details", '{ "transferredRights": [ "PER-PUB", "REG" ], "regionalLimit": ["BE", "NOWHERE", "SomeWhereElse"] }' ], parseOptions))
            .toThrowError('Invalid --tc-details: { "transferredRights": [ "PER-PUB", "REG" ], "regionalLimit": ["BE", "NOWHERE", "SomeWhereElse"] } [Error: Unknown Country code(s): NOWHERE,SomeWhereElse]')
    })

    it("succeeds with tc logion_classification", () => {
        command.parse([ "create-csv", "--tc-type", "logion_classification", "--tc-details", '{"transferredRights":["PER-PRIV","REG","TIME"],"regionalLimit":["BE","FR","US"],"expiration":"2022-09-23"}' ], parseOptions);
    })

    it("fails on wrong tc-details for specific_license", () => {
        expect(() => command.parse([ "create-csv", "--tc-type", "specific_license", "--tc-details", "ABC" ], parseOptions))
            .toThrowError('Invalid --tc-details: ABC [Error: specific_license: invalid LOC ID: ABC]')
    })

    it("succeeds with tc specific_license", () => {
        command.parse([ "create-csv", "--tc-type", "specific_license", "--tc-details", "8d24cca4-1031-43cd-9a57-65ff74eaf556" ], parseOptions);
    })

    it("fails with wrong token", () => {
        expect(() => command.parse([ "create-csv", "--with-tokens", "Unknown" ], parseOptions))
            .toThrowError("error: option '--with-tokens <tokenType>' argument 'Unknown' is invalid. Invalid token type")
    })

    it("succeeds with no option", () => {
        command.parse([ "create-csv" ], parseOptions);
    })
})

describe("CreateCsv - CSV output ", () => {

    const COLUMNS_WITHOUT_FILE = ['ID', 'DESCRIPTION', 'TERMS_AND_CONDITIONS TYPE', 'TERMS_AND_CONDITIONS PARAMETERS'] as const;
    const COLUMNS_WITH_FILE = [ ...COLUMNS_WITHOUT_FILE, 'FILE NAME', 'FILE CONTENT TYPE', 'FILE SIZE', 'FILE HASH'] as const;
    const TOKEN_COLUMNS = ['TOKEN TYPE', 'TOKEN ID', 'TOKEN ISSUANCE'] as const;
    const COLUMNS_WITH_FILE_AND_TOKEN = [ ...COLUMNS_WITH_FILE, 'RESTRICTED', ...TOKEN_COLUMNS] as const;
    const COLUMNS_WITH_TOKEN = [ ...COLUMNS_WITHOUT_FILE, ...TOKEN_COLUMNS] as const;

    function withFile(restricted: boolean): WithFile {
        return {
            name: "fileName",
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

    it("works Without File", () => {
        const row = createCsv.createRow({});
        checkKeys(row, COLUMNS_WITHOUT_FILE);
        checkCommonColumns(row, "0");
    })

    it("works With File", () => {
        const row = createCsv.createRow({ withFile: withFile(false) });
        checkKeys(row, COLUMNS_WITH_FILE);
        checkCommonColumns(row, "0");
        checkFileColumns(row);
    })

    it("works With Token", () => {
        const row = createCsv.createRow({ withToken })
        checkKeys(row, COLUMNS_WITH_TOKEN);
        checkCommonColumns(row, "0xfd8e45608baccf004189a794eee8947ad095dd561e0981fcae90309fac5cf8fe");
        checkTokenColumns(row);
    })

    it("works With restricted delivery File And Token", () => {
        const row = createCsv.createRow({ withFile: withFile(true), withToken, withTC })
        checkKeys(row, COLUMNS_WITH_FILE_AND_TOKEN);
        checkCommonColumns(row, "0xfd8e45608baccf004189a794eee8947ad095dd561e0981fcae90309fac5cf8fe", withTC);
        checkFileColumns(row, { restricted: "Y" });
        checkTokenColumns(row);
    })

    it("works With File And Token", () => {
        const row = createCsv.createRow({ withFile: withFile(false), withToken, withTC })
        checkKeys(row, COLUMNS_WITH_FILE_AND_TOKEN);
        checkCommonColumns(row, "0xfd8e45608baccf004189a794eee8947ad095dd561e0981fcae90309fac5cf8fe", withTC);
        checkFileColumns(row, { restricted: "N" });
        checkTokenColumns(row);
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

    function checkFileColumns(row: Row, withRestricted?: { restricted: string}) {
        const rowMap = row as RowMap;
        expect(rowMap['FILE NAME']).toEqual('fileName.png');
        expect(rowMap['FILE CONTENT TYPE']).toEqual('image/png');
        expect(rowMap['FILE SIZE']).toEqual(123456);
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
