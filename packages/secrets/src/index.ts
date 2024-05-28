#! /usr/bin/env node

import figlet from "figlet";
import { Command } from "commander";
import { Generate } from "./Generate.js";
import { Reconstruct } from "./Reconstruct.js";

console.log(figlet.textSync("Logion Secrets"));
const program = new Command();

const generate = new Generate();
const reconstruct =new Reconstruct();

program
    .nameFromFilename("logion-secrets")
    .description("A tool to generate encrypt secret values / reconstruct values from encrypted secrets")
    .addCommand(generate.command)
    .addCommand(reconstruct.command)
    .parse(process.argv)
