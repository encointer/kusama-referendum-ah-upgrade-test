# Kusama Referenda Upgrade Tool

A CLI tool for testing and executing Kusama referenda upgrades on Asset Hub using Chopsticks for local blockchain simulation.

## Overview

This tool automates the complete workflow of executing a Kusama parachain runtime upgrade via OpenGov referenda. It simulates the entire process locally using Chopsticks, including:

1. Creating a Fellowship referendum to whitelist the upgrade call
2. Creating a public referendum on Asset Hub to dispatch the upgrade
3. Submitting the preimage for the upgrade
4. Simulating referendum passage
5. Executing the authorized upgrade with the new runtime WASM

## Prerequisites

- Node.js (v18 or higher)
- yarn
- [opengov-cli](https://github.com/joepetrowski/opengov-cli) for generating call data

## Installation

```bash
yarn install
```

## Workflow

This tool works in conjunction with `opengov-cli` to test runtime upgrades locally before submitting them on-chain.

### Step 1: Generate Upgrade Call Data with opengov-cli

First, use `opengov-cli` to build the upgrade and generate the required call data:

```bash
cd /path/to/opengov-cli

# Build the upgrade for Asset Hub
./target/debug/opengov-cli build-upgrade \
    --network kusama \
    --only \
    --asset-hub 1.9.3
```

This will output:
- **Runtime hash** (needed for `--expected-code-hash`)
- **WASM file path** (needed for `--wasm`)

Example output:
```
Kusama Asset Hub Runtime Hash: 0x099d803ee67d6c1859d84342d61c01eed373323448f7fd230a4e85a668806448
```

### Step 2: Generate Referendum Call Data

Next, generate the call data for submitting the referendum:

```bash
./target/debug/opengov-cli submit-referendum \
    --proposal './upgrade-kusama-1.9.3/kusama-1.9.3.call' \
    --network kusama \
    --track 'whitelistedcaller' \
    --after 10 \
    --output CallData
```

This will output three hex-encoded calls:
1. **Fellowship referendum call** - Opens Fellowship referendum to whitelist the call
2. **Preimage submission call** - Submits the preimage for the public referendum
3. **Public referendum call** - Opens the public referendum to dispatch the call

Example output:
```
Open a Fellowship referendum to whitelist the call:
0x17002b0f01cc630005000100a10f05082f0000060300885e0005f693e846c0ba0cc8b657de190a4f41168443cff8acc2b5e430d011885e7255010a000000

Submit the preimage for the public referendum:
0x0600905e030009099d803ee67d6c1859d84342d61c01eed373323448f7fd230a4e85a668806448

Open a public referendum to dispatch the call:
0x5c005d0d02f5fe983139046b7551acec879b3c5e5d3dd8927d5a56cf82a61604ac2d721e1824000000010a000000
```

### Step 3: Run the Upgrade Test

Use this tool to test the complete upgrade flow locally:

```bash
LOG_LEVEL=error yarn start \
    --call-to-create-fellowship-referendum <fellowship-call-hex> \
    --signer-for-fellowship-referendum <signer-address> \
    --call-to-create-asset-hub-referendum <public-referendum-call-hex> \
    --signer-for-asset-hub-referendum <signer-address> \
    --call-to-note-preimage-for-asset-hub-referendum <preimage-call-hex> \
    --expected-code-hash <runtime-hash> \
    --wasm <path-to-wasm-file>
```

## Usage

### Complete Example

```bash
LOG_LEVEL=error yarn start \
    --call-to-create-fellowship-referendum 0x17002b0f01cc630005000100a10f05082f0000060300885e0005f693e846c0ba0cc8b657de190a4f41168443cff8acc2b5e430d011885e7255010a000000 \
    --signer-for-fellowship-referendum Ea6jhP5gF4r7NqhkEoAXJDgSgYpNQNaTYU6gPsrEGfctaKR \
    --call-to-create-asset-hub-referendum 0x5c005d0d02f5fe983139046b7551acec879b3c5e5d3dd8927d5a56cf82a61604ac2d721e1824000000010a000000 \
    --signer-for-asset-hub-referendum 5G8o24Mzsq5jzGcdUqufKnSBjFqcGkQuKkcneTkqPNcDrYWT \
    --call-to-note-preimage-for-asset-hub-referendum 0x0600905e030009099d803ee67d6c1859d84342d61c01eed373323448f7fd230a4e85a668806448 \
    --expected-code-hash 0x099d803ee67d6c1859d84342d61c01eed373323448f7fd230a4e85a668806448 \
    --wasm ./upgrade-kusama-1.9.3/asset-hub-kusama_runtime-v1009003.compact.compressed.wasm
```

### Environment Variables

- `LOG_LEVEL` - Set to `error` to suppress verbose Chopsticks logs

## How It Works

The tool executes the following steps:

1. **Network Setup**: Initializes local Kusama relay chain and Asset Hub networks using Chopsticks
2. **Fellowship Referendum**: Submits the fellowship referendum to whitelist the upgrade call
3. **Public Referendum**: Creates the public referendum on Asset Hub for the upgrade
4. **Preimage Submission**: Submits the preimage containing the upgrade call details
5. **Referendum Passage Simulation**: Simulates both referenda passing by manipulating on-chain state
6. **Code Hash Validation**: Verifies the authorized upgrade code hash matches the expected value
7. **Upgrade Execution**: Applies the authorized upgrade with the provided WASM runtime

## Development

### Run with full logs

```bash
yarn start --help
```

### Linting

```bash
yarn lint
yarn lint:fix
```

### Formatting

```bash
yarn format
yarn format:fix
```

## Related Tools

- [opengov-cli](https://github.com/joepetrowski/opengov-cli) - CLI tool for generating OpenGov referendum call data
- [Chopsticks](https://github.com/AcalaNetwork/chopsticks) - Tool for simulating Substrate-based blockchains locally

## License

MIT
