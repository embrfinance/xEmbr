<br />

This repo contains all contracts and tests relevant to the core xEmbr protocol.

Core xEmbr contracts utilise OpenZeppelin's [InitializableAdminUpgradeabilityProxy](https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol) to facilitate future upgrades, fixes or feature additions. The upgrades are proposed by the xEmbr Governors (with current governor address stored in the [Fulcrum](./contracts/fulcrum/Fulcrum.sol) - the system kernel) and executed via the [DelayedProxyAdmin](./contracts/upgradability/DelayedProxyAdmin.sol). Both changes to the `governor`, and contract upgrades have a one week delay built in to execution. This allows xEmbr users a one week opt out window if they do not agree with the given change.

<br />

🏠 https://embr.finanace  
📄 https://docs.embr.finanace

<br />


---

<br />

## Branches

-   `master` contains complete, tested and audited contract code, generally on `mainnet`
-   `beta` is for the pre-release code, generally on `ropsten`

<br />

## Dev notes

### Prerequisites

-   Node.js v10.22.0 (you may wish to use [nvm][1])
-   [ganache-cli][2]

### Installing dependencies

```
$ yarn
```

### Testing

Tests are written with Hardhat, Ethers, Waffle & Typescript, using [Typechain](https://github.com/ethereum-ts/TypeChain) to generate typings for all contracts. Tests are executed using `hardhat` in hardhats evm.

```
$ yarn test
```

#### Suite

Key folders:

-   `/contracts/z_mocks`: All mocks used throughout the test suite
-   `/security`: Scripts used to run static analysis tools like Slither and Securify
-   `/test`: Unit tests in folders corresponding to contracts/xx
-   `/test-utils`: Core util files used throughout the test framework
    -   `/machines`: Mock contract machines for creating configurable instances of the contracts
-   `/types`: TS Types used throughout the suite
    -   `/generated`: Output from Typechain; strongly-typed, Ethers-flavoured contract interfaces

### CI

Codebase rules are enforced through a passing [CI](https://circleci.com) (visible in `.circleci/config.yml`). These rules are:

-   Linting of both the contracts (through Solium) and TS files (ESLint)
-   Passing test suite
-   Maintaining high unit testing coverage

### Code formatting

-   Solidity imports deconstructed as `import { xxx } from "../xxx.sol"`
-   Solidity commented as per [NatSpec format](https://solidity.readthedocs.io/en/v0.5.0/layout-of-source-files.html#comments)
-   Internal function ordering from high > low order

<br />

[1]: https://github.com/nvm-sh/nvm
[2]: https://github.com/trufflesuite/ganache-cli

### Command Line Interface

[Hardhat Tasks](https://hardhat.org/guides/create-task.html) are used for command line interactions with the mStable contracts. The tasks can be found in the [tasks](./tasks) folder.

A separate Hardhat config file [tasks.config.ts](./tasks.config.ts) is used for task config. This inherits from the main Hardhat config file [hardhat.config.ts](./hardhat.config.ts). This avoids circular dependencies when the repository needs to be compiled before the Typechain artifacts have been generated. This means the `--config tasks.config.ts` Hardhat option needs to be used to run the mStable tasks.

Config your network. If you are just using readonly tasks like `mBTC-snap` you don't need to have a signer with Ether in it so the default Hardhat test account is ok to use. For safety, the mainnet config is not committed to the repository to avoid accidentally running tasks against mainnet.

```
mainnet: {
    url: process.env.NODE_URL || "",
    accounts: {
        mnemonic: "test test test test test test test test test test test junk",
    },
},
```

**Never commit mainnet private keys, mnemonics or provider URLs to the repository.**

Examples of using the Hardhat tasks

```zsh
# List all Hardhat tasks
hh --config tasks.config.ts

# Set the provider url
export NODE_URL=https://mainnet.infura.io/v3/yourApiKey

# To run the mBTC-snap task against mainnet
yarn task mBTC-snap --network mainnet
```
