import { UUID } from "@logion/node-api";
import { LogionClassification, TermsAndConditionsElementType, CreativeCommons } from "@logion/client";

export function isValidOrThrow(type: TermsAndConditionsElementType, tcParametersFromCsv: string) {

    if (type === "logion_classification") {
        LogionClassification.validateDetails(tcParametersFromCsv);
    } else if (type === "CC4.0") {
        CreativeCommons.validateDetails(tcParametersFromCsv);
    } else if (type === "specific_license") {
        // In the details column from the CSV we expect to find the specific T&C LOC ID.
        // Actual details attribute cannot be populated from CSV import.
        if (UUID.fromAnyString(tcParametersFromCsv) === undefined) {
            throw Error(`specific_license: invalid LOC ID: ${ tcParametersFromCsv }`);
        }
    } else {
        throw Error(`Unknown T&C type: ${ type }`)
    }
}
