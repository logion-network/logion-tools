import { Command } from "commander";
import { ReadItemsCsvResult, CsvValidator, CsvRow } from "@logion/csv";
import { createReadStream } from "fs";
import csv from "csv-parser";
import fs from "fs";
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
            .action(csvFiles => csvFiles.forEach((csvFile: string) => this.validateCsv(csvFile)))
    }

    private async validateCsv(csvFile: string) {
        fs.lstat(csvFile, (err, stats) => {
            if (err) {
                console.error(err)
            } else if (stats && stats.isFile()) {
                const stream = createReadStream(csvFile);
                this.readItemsCsv(stream).then(result => {
                    if ("fullyValidated" in result) {
                        if (result.fullyValidated) {
                           console.log(`✅️ ${ csvFile }: validated - detected type [${ result.rowType }]. ${ result.items.length } row(s)`);
                        } else {
                            console.log(`⚠️️  ${ csvFile }: validation failure - detected type [${ result.rowType }]. ${ result.items.length } row(s)`);
                            console.log("Summary of errors:");
                            console.log(result.errorSummary);
                        }
                    } else {
                        console.warn(`⛔ ${ csvFile }: validation failure: ${ result.error }`);
                    }
                }, rejectReason => {
                    console.error(rejectReason)
                })
            } else {
                console.warn(`⏭️  ${ csvFile }: skipped`)
            }
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
