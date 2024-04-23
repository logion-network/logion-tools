# logion-import

## Install

Install locally:
`npm install @logion/import`

Install globally:
`sudo npm install @logion/import -g`

## Run

Run previously installed :
`logion-import`

Run without installation
`npx @logion/import`

## Develop

```shell
yarn build

# Test CSV validation
node dist/index validate-csv samples/*

# Test CSV creation
node dist/index create-csv --with-files image/png --with-tokens owner
```

## Integration tests

### Pre-requisites

Below steps must be executed only if you did not yet create the `logion-test` network.

- Create `logion-test` network: `docker network create logion-test`
- Get network's gateway IP address: `docker network inspect logion-test | jq '.[0].IPAM.Config[0].Gateway'`
- Set `RPC_WS` variable in `.env` file (see `.env.sample` for an example) with the above IP address

### Running the tests

- Start the Logion chain locally (see [here](https://github.com/logion-network/logion-collator/?tab=readme-ov-file#test-locally))
- In another terminal, run the tests: `yarn integration-test`
- Stop Zombienet

