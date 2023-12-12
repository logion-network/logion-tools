import { Command } from "commander";
import { ReadItemsCsvResult, CsvValidator, CsvRow, SuccessfulReadItemsCsv } from "@logion/csv";
import fs, { createReadStream } from "fs";
import csv from "csv-parser";
import { Readable } from "stream";

export class ValidateCsv {

    constructor() {
        this._command = this.createCommand();
    }

    private readonly _command: Command;

    get command() {
        return this._command;
    }

    private createCommand(): Command {
        return new Command("validate-csv")
            .argument("<csvFiles...>", "the csv files to validate")
            .action(csvFiles => this.validateCsvFiles(csvFiles))
            .description("To validate given CSV file(s)")
    }

    private async validateCsvFiles(csvFiles: string []): Promise<void> {
        await Promise.all(csvFiles.map((csvFile: string) => this.validateCsv(csvFile)));
    }

    /**
     * Validate the given CSV file, and echo the result to the console.
     * Return the result only if it's ready to be imported (i.e. fully validated).
     * @param csvFile the path to the CSV file.
     * @return result or undefined
     */
    async validateCsv(csvFile: string): Promise<SuccessfulReadItemsCsv | undefined> {
        return new Promise<SuccessfulReadItemsCsv | undefined>((resolve) => {
            fs.lstat(csvFile, (err, stats) => {
                if (err) {
                    console.error(err);
                    resolve(undefined);
                } else if (stats && stats.isFile()) {
                    const stream = createReadStream(csvFile);
                    this.readItemsCsv(stream).then(result => {
                        if ("fullyValidated" in result) {
                            if (result.fullyValidated) {
                                console.log(`✅️ ${ csvFile }: validated - detected type [${ result.rowType }]. ${ result.items.length } row(s)`);
                                resolve(result);
                            } else {
                                console.log(`⚠️️  ${ csvFile }: validation failure - detected type [${ result.rowType }]. ${ result.items.length } row(s)`);
                                console.log("Summary of errors:");
                                console.log(result.errorSummary);
                                resolve(undefined);
                            }
                        } else {
                            console.warn(`⛔ ${ csvFile }: validation failure: ${ result.error }`);
                            resolve(undefined);
                        }
                    }, rejectReason => {
                        console.error(rejectReason)
                        resolve(undefined);
                    })
                } else {
                    console.warn(`⏭️  ${ csvFile }: skipped`)
                    resolve(undefined);
                }
            })
        })
    }

    async readItemsCsv(stream: Readable): Promise<ReadItemsCsvResult> {
        return new Promise<ReadItemsCsvResult>((resolve, reject) => {
            const validator = new CsvValidator();
            stream.pipe(csv())
                .on("data", (data: CsvRow) => {
                    const error = validator.validate(data);
                    if (error !== undefined) {
                        stream.destroy();
                        resolve(error);
                    }
                })
                .on("error", (error: any) => reject(error)) // eslint-disable-line @typescript-eslint/no-explicit-any
                .on("end", () => {
                    resolve(validator.result());
                });
        });
    }
}
