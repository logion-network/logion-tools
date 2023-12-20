
export class BatchMaker<T> {

    private readonly source: T[];
    readonly batchSize: number;
    readonly numOfBatches: number

    constructor(source: T[], batchSize: number) {
        this.source = source;
        this.batchSize = batchSize;
        this.numOfBatches = Math.ceil(source.length / batchSize);
    }

    getBatch(index: number): T[] {
        if (index >= this.numOfBatches) {
            throw Error("index out-of-range")
        }
        return this.source.slice(index * this.batchSize, (index + 1) * this.batchSize)
    }
}
