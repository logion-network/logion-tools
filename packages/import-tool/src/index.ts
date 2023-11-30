#! /usr/bin/env node

import figlet from "figlet";
import { Command } from "commander";
import { CreateCsv } from "./CreateCsv.js";

console.log(figlet.textSync("Logion Import"));
const program = new Command();

const createCsv = new CreateCsv();

program
    .nameFromFilename("logion-import")
    .description("A tool to scaffold / validate CSV items, to import a directory")
    .addCommand(createCsv.command)
    .parse(process.argv)
