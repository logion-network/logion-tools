import { Generate } from "../src/Generate.js";
import { Reconstruct } from "../src/Reconstruct.js";

const EXPECTED_DATA = "My very secret key to be protected";

describe("Generate", () => {

    it("generates secrets that reconstructs correctly", async () => {
        const generate = new Generate();
        const secrets = generate.generate(Buffer.from(EXPECTED_DATA));
        const reconstruct = new Reconstruct();
        const actualData = (await reconstruct.reconstruct(secrets)).toString();
        expect(EXPECTED_DATA).toEqual(actualData);
    })

    it("does not generate twice the same secrets", () => {
        const generate = new Generate();
        const firstSecrets = generate.generate(Buffer.from(EXPECTED_DATA));
        const secondSecrets = generate.generate(Buffer.from(EXPECTED_DATA));

        expect(firstSecrets.secret1).not.toEqual(secondSecrets.secret1);
        expect(firstSecrets.secret1).not.toEqual(secondSecrets.secret2);
        expect(firstSecrets.secret2).not.toEqual(secondSecrets.secret1);
        expect(firstSecrets.secret2).not.toEqual(secondSecrets.secret2);
    })
})

describe("Reconstruct", () => {

    it("reconstructs expected data", async () => {
        const reconstruct = new Reconstruct();
        const reconstructed = await reconstruct.reconstruct({
            secret1: "LT6TDL0XU5K70ronfigBM3x1zdosZjz7NKK54raCB6bDFEMJge+YK8/KWm0Mj45+JzQqJhavu7ZQXnCOXwbJxQ==",
            secret2: "FV0ufF3ZFDwBNMH+sCWkTzCr31Tj/S5vOh60xaJm7Os=",
        });
        expect(reconstructed.toString()).toEqual(EXPECTED_DATA);
    })
})
