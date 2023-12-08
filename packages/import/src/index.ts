#! /usr/bin/env node

import figlet from "figlet";
import { Command } from "commander";
import { CreateCsv } from "./CreateCsv.js";
import { ValidateCsv } from "./ValidateCsv.js";

console.log(figlet.textSync("Logion Import"));
const program = new Command();

const createCsv = new CreateCsv();
const validateCsv = new ValidateCsv();

program
    .nameFromFilename("logion-import")
    .description("A tool to scaffold / validate CSV items, to import a directory")
    .addCommand(createCsv.command)
    .addCommand(validateCsv.command)
    .parse(process.argv)
