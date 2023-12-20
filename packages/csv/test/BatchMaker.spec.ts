import { BatchMaker } from "../src/BatchMaker.js";

describe("BatchMaker", () => {

    const source = [0, 1, 2, 3, 4, 5];

    it("provides same size batches", () => {
        const batchMaker = new BatchMaker(source, 3);
        expect(batchMaker.numOfBatches).toEqual(2);
        expect(batchMaker.getBatch(0)).toEqual([0,1,2]);
        expect(batchMaker.getBatch(1)).toEqual([3,4,5]);
        expect(() => batchMaker.getBatch(2)).toThrowError("index out-of-range");
    })

    it("provides smaller last batch", () => {
        const batchMaker = new BatchMaker(source, 4);
        expect(batchMaker.numOfBatches).toEqual(2);
        expect(batchMaker.getBatch(0)).toEqual([0,1,2,3]);
        expect(batchMaker.getBatch(1)).toEqual([4,5]);
        expect(() => batchMaker.getBatch(2)).toThrowError("index out-of-range");
    })

    it("provides at least one batch", () => {
        const batchMaker = new BatchMaker(source, 10);
        expect(batchMaker.numOfBatches).toEqual(1);
        expect(batchMaker.getBatch(0)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(() => batchMaker.getBatch(1)).toThrowError("index out-of-range");
    })
})
