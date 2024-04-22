import { CsvItem } from "./CsvValidator.js";
import {
    HashOrContent,
    MimeType,
    ItemTokenWithRestrictedType,
    TokenType,
    LogionClassificationParameters,
    SpecificLicense,
    CreativeCommonsCode
} from "@logion/client";
import { UUID, Hash } from "@logion/node-api";

export interface Item {
    id?: Hash;
    displayId: string;
    description: string;
    files: HashOrContent[];
    restrictedDelivery: boolean;
    token?: ItemTokenWithRestrictedType;
    upload: boolean;
    logionClassification?: LogionClassificationParameters,
    specificLicense?: SpecificLicense,
    creativeCommons?: CreativeCommonsCode,
}

export function toItem(csvItem: CsvItem, collectionAcceptsUpload: boolean): Item {
    const id = csvItem.id;
    const displayId = csvItem.displayId;
    const description = csvItem.description;

    let files: HashOrContent[] = [];
    if ("fileName" in csvItem) {
        files = [
            HashOrContent.fromDescription({
                hash: csvItem.fileHash,
                mimeType: MimeType.from(csvItem.fileContentType),
                name: csvItem.fileName,
                size: BigInt(csvItem.fileSize),
            }),
        ];
    }

    let restrictedDelivery = false;
    if ("restrictedDelivery" in csvItem) {
        restrictedDelivery = csvItem.restrictedDelivery;
    }

    let token: ItemTokenWithRestrictedType | undefined;
    if ("tokenType" in csvItem) {
        if (csvItem.tokenType && csvItem.tokenId && csvItem.tokenIssuance) {
            token = {
                type: csvItem.tokenType as TokenType,
                id: csvItem.tokenId,
                issuance: BigInt(csvItem.tokenIssuance),
            };
        }
    }

    return {
        id,
        displayId,
        description,
        files,
        restrictedDelivery,
        token,
        upload: collectionAcceptsUpload && files.length > 0,
        logionClassification: csvItem.termsAndConditionsType === "logion_classification" ? JSON.parse(csvItem.termsAndConditionsParameters) as LogionClassificationParameters : undefined,
        specificLicense: csvItem.termsAndConditionsType === "specific_license" ? new SpecificLicense(UUID.fromAnyString(csvItem.termsAndConditionsParameters) as UUID, "") : undefined,
        creativeCommons: csvItem.termsAndConditionsType === "CC4.0" ? csvItem.termsAndConditionsParameters as CreativeCommonsCode : undefined,
    };
}
