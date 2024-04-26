import { ValidAccountId, LogionNodeApiClass, Lgnt, UUID } from "@logion/node-api";
import { Keyring, ApiPromise } from "@polkadot/api";
import {
    FullSigner,
    KeyringSigner,
    SignAndSendStrategy,
    ISubmittableResult,
    LogionClient,
    LegalOfficerClass,
    LogionClientConfig,
    requireDefined,
    PendingRequest,
    AcceptedRequest,
    OpenLoc,
    waitFor,
    LocRequestState,
} from "@logion/client";
import { NodeAxiosFileUploader } from "@logion/client-node";
import fs from "fs/promises";

export const ALICE = "vQx5kESPn8dWyX4KxMCKqUyCaWUwtui1isX6PVNcZh2Ghjitr";
export const ALICE_SECRET_SEED = "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";
export const REQUESTER_ADDRESS = "vQtc8ViMVqMFymbKcCgV4VWaEkRKPQzXGtBFJb423qMn56cxf";

class IntegrationTestSignAndSendStrategy implements SignAndSendStrategy {

    canUnsub(result: ISubmittableResult): boolean {
        return result.isCompleted;
    }
}

export function buildSigner(seeds: string []): FullSigner {
    const keyring = new Keyring({ type: 'sr25519' });
    seeds.forEach(seed => keyring.addFromUri(seed.trim()));
    return new KeyringSigner(keyring, new IntegrationTestSignAndSendStrategy());
}

export const TEST_LOGION_CLIENT_CONFIG: LogionClientConfig = {
    directoryEndpoint: "http://localhost:8090",
    rpcEndpoints: [ 'ws://localhost:9944' ],
    buildFileUploader: () => new NodeAxiosFileUploader(),
};

export interface State {
    signer: FullSigner;
    client: LogionClient;
    alice: LegalOfficerClass;
    requesterAccount: ValidAccountId,
}

export async function setupInitialState(workDir: string): Promise<State> {
    let anonymousClient = await LogionClient.create(TEST_LOGION_CLIENT_CONFIG);

    const requesterSecretSeed = await fs.readFile(`${ workDir }/suri.txt`, { encoding: 'utf8' });
    const signer = buildSigner([
        requesterSecretSeed,
        ALICE_SECRET_SEED,
    ]);
    const requesterAccount = ValidAccountId.polkadot(REQUESTER_ADDRESS)
    const aliceAccount = ValidAccountId.polkadot(ALICE);

    await updateLegalOfficers({
        api: anonymousClient.logionApi.polkadot,
        signer,
        aliceAccount,
    });

    anonymousClient = await LogionClient.create(TEST_LOGION_CLIENT_CONFIG);

    let client = await anonymousClient.authenticate([
        requesterAccount,
        aliceAccount,
    ], signer);
    const legalOfficers = client.legalOfficers;
    console.log(legalOfficers.map(llo => `${ llo.name }:${ llo.account.address }`))
    const alice = requireDefined(legalOfficers.find(legalOfficer => legalOfficer.account.equals(aliceAccount)));

    const state = {
        client,
        signer,
        alice,
        requesterAccount,
    };

    await initRequester(state);

    return state;
}

export async function initAccountBalance(state: State, account: ValidAccountId): Promise<void> {
    console.log(`Initializing account balance of ${ account.address }`);
    const { alice, client, signer } = state
    const api = await LogionNodeApiClass.connect(client.config.rpcEndpoints);
    const setBalance = api.polkadot.tx.balances.forceSetBalance(account.address, Lgnt.from(10000).canonical);
    await signer.signAndSend({
        signerId: alice.account,
        submittable: api.polkadot.tx.sudo.sudo(setBalance),
    });
}


async function initRequester(state: State): Promise<UUID> {
    await initAccountBalance(state, state.requesterAccount);
    return  createIdentityLoc(state);
}

async function createIdentityLoc(state: State): Promise<UUID> {
    const { requesterAccount, alice } = state;
    const legalOfficer = alice;

    const requesterClient = state.client.withCurrentAccount(requesterAccount);

    let requesterLocsState = await requesterClient.locsState();
    const pendingRequest = await requesterLocsState.requestIdentityLoc({
        legalOfficerAccountId: legalOfficer.account,
        description: "KYC - requester",
        userIdentity: {
            email: "john.doe.trusted@invalid.domain",
            firstName: "John",
            lastName: "Trusted",
            phoneNumber: "+1234",
        },
        userPostalAddress: {
            line1: "Peace Street",
            line2: "2nd floor",
            postalCode: "10000",
            city: "MyCity",
            country: "Wonderland"
        },
        draft: false,
    }) as PendingRequest;

    return acceptOpenClose(pendingRequest, state)
}

export async function createTransactionLoc(description: string, state: State): Promise<UUID> {

    const { requesterAccount, alice } = state;
    const legalOfficer = alice;

    let client = state.client.withCurrentAccount(requesterAccount);
    let locsState = await client.locsState();

    const locRequest = await locsState.requestTransactionLoc({
        legalOfficerAccountId: legalOfficer.account,
        description,
        draft: false,
    }) as PendingRequest;

    return acceptOpenClose(locRequest, state);
}

export async function createCollectionLoc(description: string, state: State): Promise<UUID> {

    const { requesterAccount, alice } = state;
    const legalOfficer = alice;

    let client = state.client.withCurrentAccount(requesterAccount);
    let locsState = await client.locsState();

    const locRequest = await locsState.requestCollectionLoc({
        legalOfficerAccountId: legalOfficer.account,
        description,
        draft: false,
        legalFee: Lgnt.zero(),
        collectionItemFee: Lgnt.zero(),
        collectionParams: {
            canUpload: true,
            maxSize: 1000,
        },
        tokensRecordFee: Lgnt.zero(),
        valueFee: Lgnt.zero(),
    }) as PendingRequest;

    return acceptOpenClose(locRequest, state);
}

async function acceptOpenClose(locRequest: PendingRequest, state: State): Promise<UUID> {

    const { signer, alice, client } = state;
    let legalOfficerClient = client.withCurrentAccount(alice.account);
    let legalOfficerLocRequest = await findWithLegalOfficerClient(legalOfficerClient, locRequest) as PendingRequest;
    const legalOfficerAcceptedRequest = await legalOfficerLocRequest.legalOfficer.accept({ signer }) as AcceptedRequest;
    const acceptedRequest = await locRequest.refresh() as AcceptedRequest;
    const locData = acceptedRequest.data();
    console.log("Opening %s (%s) LOC %s %s", locData.locType, locData.description, locData.id.toString(), locData.id.toDecimalString());
    await acceptedRequest.open({ signer, autoPublish: false });
    let legalOfficerOpenLoc = await legalOfficerAcceptedRequest.refresh() as OpenLoc;
    legalOfficerOpenLoc = await waitFor<OpenLoc>({
        producer: prev => prev ? prev.refresh() as Promise<OpenLoc> : legalOfficerOpenLoc.refresh() as Promise<OpenLoc>,
        predicate: state => state.legalOfficer.canClose(false),
    });
    const closed = await legalOfficerOpenLoc.legalOfficer.close({ signer, autoAck: false });
    return closed.locId;
}

async function updateLegalOfficers(params: { api: ApiPromise, aliceAccount: ValidAccountId, signer: FullSigner }): Promise<void> {
    const { api, aliceAccount, signer } = params;

    await signer.signAndSend({
        signerId: aliceAccount,
        submittable: api.tx.loAuthorityList.updateLegalOfficer(
            aliceAccount.address,
            {
                Host: {
                    nodeId: "0x0024080112201ce5f00ef6e89374afb625f1ae4c1546d31234e87e3c3f51a62b91dd6bfa57df",
                    baseUrl: "http://localhost:8080",
                    region: "Europe",
                }
            }
        ),
    });
}

export async function tearDown(state: State) {
    return state.client.disconnect();
}

export async function findWithLegalOfficerClient(client: LogionClient, loc: LocRequestState): Promise<LocRequestState> {
    if(!client.currentAccount) {
        throw new Error("Client must be authenticated");
    }
    const locType = loc.data().locType;
    const locStatus = loc.data().status;
    let legalOfficerLocs = await client.locsState({ spec: { ownerAddress: client.currentAccount.address, locTypes: [locType], statuses: [locStatus] } });
    return legalOfficerLocs.findById(loc.locId);
}
