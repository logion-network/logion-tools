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


