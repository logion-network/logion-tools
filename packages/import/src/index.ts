#! /usr/bin/env node

import figlet from "figlet";
import { Command } from "commander";
import { CreateCsv } from "./CreateCsv.js";
import { ValidateCsv } from "./ValidateCsv.js";
import { ImportCsv } from "./ImportCsv.js";

console.log(figlet.textSync("Logion Import"));
const program = new Command();

const createCsv = new CreateCsv();
const validateCsv = new ValidateCsv();
const importCsv = new ImportCsv(validateCsv);

program
    .nameFromFilename("logion-import")
    .description("A tool to create / validate / import CSV containing collection items")
    .addCommand(createCsv.command)
    .addCommand(validateCsv.command)
    .addCommand(importCsv.command)
    .parse(process.argv)
