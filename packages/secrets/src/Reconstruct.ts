import { Command, Option } from "commander";
import { Encryption } from "./Encryption.js";
import { Secrets, Suri, ENCODING } from "./Types.js";
import fs from "fs/promises";
import { existsSync } from "fs";

export interface ReconstructParams extends Secrets, Suri {
}

export class Reconstruct {

    constructor() {
        this._command = this.createCommand();
    }

    private readonly _command: Command;
    private readonly encryption: Encryption = new Encryption();

    get command() {
        return this._command;
    }

    private createCommand(): Command {
        return new Command("reconstruct")
            .addOption(new Option("--suri-file <suriFilePath>", "The path to reconstruct the Secret key of the account")
                .makeOptionMandatory()
            )
            .addOption(new Option("--secret1 <secret1>", "The Secret1 value")
                .makeOptionMandatory()
            )
            .addOption(new Option("--secret2 <secret2>", "The Secret2 value")
                .makeOptionMandatory()
            )
            .action((params: ReconstructParams) => this.reconstruct(params)
                .then(value => this.writeFile(params.suriFile, value)))
            .description("Generate new secrets from given suri.")
    }

    async reconstruct(params: Secrets): Promise<Buffer> {
        const encrypted = Buffer.from(params.secret1, ENCODING);
        const key = Buffer.from(params.secret2, ENCODING);
        return this.encryption.decrypt({ encrypted, key });
    }

    private async writeFile(suriFile: string, data: Buffer): Promise<void> {
        if (existsSync(suriFile)) {
            throw Error(`File already exists: ${ suriFile }`);
        }
        await fs.writeFile(suriFile, data);
        console.log(`Reconstructed SURI was written to '${ suriFile }'`);
    }
}
