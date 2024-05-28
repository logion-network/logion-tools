# logion-secrets

## Install

from published package
```shell
sudo npm install @logion/secrets -g`
```

from sources:
```shell
sudo npm install . -g
```

## Usage
To generate the secrets from a secret key stored in `./test/sample-suri.txt`:

```shell
logion-secrets generate --suri-file ./test/sample-suri.txt`
```

To reconstruct a secret key and write it to the file `/tmp/sample-suri.txt`:

```shell
logion-secrets reconstruct \
--secret1 YLS+hsOaYqPdJLoTqHCg/muhOemq2kr6weHCi+iSWoafNbynSU7gUCy+k2O6WKyQ1NwnajNupaqhdYI+9dCdPpmi/6OSj39/FuzandUFOZ5tlyH/z9kUE7Wqfl4/tR07 \
--secret2 7vCliS/rP+w1pyDRuq3flXT5LE6IXj1CnTOS4/cdTwQ= \
--suri-file /tmp/sample-suri.txt
```
