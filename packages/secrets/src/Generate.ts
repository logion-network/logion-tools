import { Command, Option } from "commander";
import fs from "fs/promises";
import { randomBytes } from 'crypto';
import { Encryption } from "./Encryption.js";
import { Secrets, Suri, ENCODING } from "./Types.js";

const KEY_LENGTH = 32;

export class Generate {

    constructor() {
        this._command = this.createCommand();
    }

    private readonly _command: Command;
    private readonly encryption: Encryption = new Encryption();

    get command() {
        return this._command;
    }

    private createCommand(): Command {
        return new Command("generate")
            .addOption(new Option("--suri-file <suriFilePath>", "The path to the Secret key of the account")
                .makeOptionMandatory()
            )
            .action((params: Suri) => this.readFile(params).then(
                data => this.display(this.generate(data)))
            )
            .description("Generate new secrets from given suri.")
    }

    async readFile(params: Suri): Promise<Buffer> {
        return await fs.readFile(params.suriFile);
    }

    generate(data: Buffer): Secrets {
        const key = randomBytes(KEY_LENGTH);
        const encrypted = this.encryption.encrypt({ data, key });
        return {
            secret1: encrypted.toString(ENCODING),
            secret2: key.toString(ENCODING),
        }
    }

    display(secrets: Secrets) {
        console.log("Secret 1 should now be protected by Logion (go to one of your closed Identity LOCs).");
        console.log("Secret 2 should be protected either by Logion (but in another closed Identity LOC) or another third-party solution.\n");
        console.log(`Secret 1: ${ secrets.secret1 }`);
        console.log(`Secret 2: ${ secrets.secret2 }`);
    }
}
