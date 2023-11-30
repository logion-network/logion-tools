import { CreateCsv, WithFile, WithToken } from "../src/CreateCsv.js";
import { ParseOptions, Command } from "commander";
import { Row } from "@fast-csv/format/build/src/types";
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

    const withFile: WithFile = {
        name: "fileName",
        contentType: MimeType.from("image/png"),
        restricted: true,
    };

    const withToken: WithToken = {
        type: "astar_psp34",
        nonce: "",
        issuance: 1,
        contractAddress: "ABC",
    };

    let createCsv = new CreateCsv();

    it("works Without File", () => {
        const row = createCsv.createRow({})
        checkKeys(row, COLUMNS_WITHOUT_FILE)
    })

    it("works With File", () => {
        const row = createCsv.createRow({ withFile });
        checkKeys(row, COLUMNS_WITH_FILE)
    })

    it("works With Token", () => {
        const row = createCsv.createRow({ withToken })
        checkKeys(row, COLUMNS_WITH_TOKEN)
    })

    it("works With File And Token", () => {
        const row = createCsv.createRow({ withFile, withToken })
        checkKeys(row, COLUMNS_WITH_FILE_AND_TOKEN)
    })

    function checkKeys(row: Row, keys: readonly string[]) {
        expect(Object.keys(row)).toEqual(keys);
    }
})
