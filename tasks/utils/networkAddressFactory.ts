import { DEAD_ADDRESS } from "@utils/constants"
import { ethereumAddress } from "@utils/regex"
import { AssetAddressTypes, Chain, Token, tokens } from "./tokens"

export const contractNames = [
    "Fulcrum",
    "DelayedProxyAdmin",
    "ProxyAdmin",
    "ProtocolDAO",
    "Governor",
    "FundManager",
    // Will become the EmissionsController
    "RewardsDistributor",
    "VoterProxy",
    "Collector",
    "Ejector",
    "Poker",
    "SignatureVerifier",
    "QuestManager",
    "QuestMaster",
    "QuestSigner",
    "xEmbrToken",
    "OperationsSigner",
    "VotiumBribe",
    "VotiumForwarder",
] as const
export type ContractNames = typeof contractNames[number]

export interface HardhatRuntime {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethers?: any
    hardhatArguments?: {
        config?: string
    }
    network?: {
        name: string
    }
}

export const getChainAddress = (contractName: ContractNames, chain: Chain): string => {
    if (chain === Chain.avalanche) {
        switch (contractName) {
            case "Fulcrum":
                return "0xAFcE80b19A8cE13DEc0739a1aaB7A028d6845Eb3"
            case "DelayedProxyAdmin":
                return "0x5C8eb57b44C1c6391fC7a8A0cf44d26896f92386"
            case "ProxyAdmin":
                return "0x3517F5a251d56C768789c22E989FAa7d906b5a13"
            case "ProtocolDAO":
            case "Governor":
                return "0xF6FF1F7FCEB2cE6d26687EaaB5988b445d0b94a2"
            case "FundManager":
                return "0x437E8C54Db5C66Bb3D80D2FF156e9bfe31a017db"
            case "RewardsDistributor":
                return "0xcecD056faa025cc15216c8bDaD15869639A034dE"
            case "VoterProxy":
                return "0x10D96b1Fd46Ce7cE092aA905274B8eD9d4585A6E"
            case "QuestMaster":
                return "0x3dd46846eed8D147841AE162C8425c08BD8E1b41"
            case "QuestSigner":
                return "0xfe99964d9677d7dfb66c5ca609b64f710d2808b8"
            case "SignatureVerifier":
                return "0xC973413fe4944682910b97b261456EB9633A4756"
            case "QuestManager":
                return "0x861f12764780896FD783eA615Dd55Df0FF865752"
            case "OperationsSigner":
                return "0xb81473f20818225302b8fffb905b53d58a793d84"
            case "VotiumBribe":
                return "0x19bbc3463dd8d07f55438014b021fb457ebd4595"
            case "VotiumForwarder":
                return "0xb6d519a0D616f6F5Fac2b1dBC5bcb92ea58EDa4a"
            default:
        }
    } else if (chain === Chain.fuji) {
        switch (contractName) {
            case "Fulcrum":
                return "0x7DCad6dd2D16A30B9A89181CC2AEfc547377fb9C"
            case "DelayedProxyAdmin":
                return "0xAA0068Db1a70623CA84480fbba490Ee28fe7ba95"
            case "ProxyAdmin":
                return "0xFEb06159e2d3AC37f8B5c609A04B94dc6E11982f"
            case "ProtocolDAO":
            case "Governor":
                return "0xFEb06159e2d3AC37f8B5c609A04B94dc6E11982f"
            case "FundManager":
                return "0xFEb06159e2d3AC37f8B5c609A04B94dc6E11982f"
            case "RewardsDistributor":
                return "0xF32A2643bd905d6C2529098369F92EB5D83936a1"
            case "VoterProxy":
                return "0x10D96b1Fd46Ce7cE092aA905274B8eD9d4585A6E"
            case "QuestMaster":
                return "0xFEb06159e2d3AC37f8B5c609A04B94dc6E11982f"
            case "QuestSigner":
                return "0xFEb06159e2d3AC37f8B5c609A04B94dc6E11982f"
            case "SignatureVerifier":
                return "0x922e11B60315307DBbAf0971E1a1E6A016E769aE"
            case "QuestManager":
                return "0xB3D1ed6d348f8816b40aCa7476D00fE6f923E982"
            case "OperationsSigner":
                return "0xFEb06159e2d3AC37f8B5c609A04B94dc6E11982f"
            case "VotiumBribe":
                return "0x19bbc3463dd8d07f55438014b021fb457ebd4595"
            case "VotiumForwarder":
                return "0xb6d519a0D616f6F5Fac2b1dBC5bcb92ea58EDa4a"
            case "xEmbrToken":
                return "0x277230592cf3C552cEfb7138a0d247079524B734"
            default:
        }
    }

    return undefined
}

export const getChain = (hre: HardhatRuntime = {}): Chain => {
    if (hre?.network.name === "mainnet" || hre?.hardhatArguments?.config === "tasks-fork.config.ts") {
        return Chain.mainnet
    }
    if (hre?.network.name === "polygon_mainnet" || hre?.hardhatArguments?.config === "tasks-fork-polygon.config.ts") {
        return Chain.polygon
    }
    if (hre?.network.name === "polygon_testnet") {
        return Chain.mumbai
    }
    if (hre?.network.name === "ropsten") {
        return Chain.ropsten
    }
    if (hre?.network.name === "fuji") {
        return Chain.fuji
    }
    if (hre?.network.name === "avalanche") {
        return Chain.avalanche
    }
    return Chain.mainnet
}

export const getNetworkAddress = (contractName: ContractNames, hre: HardhatRuntime = {}): string => {
    const chain = getChain(hre)
    return getChainAddress(contractName, chain)
}

// Singleton instances of different contract names and token symbols
const resolvedAddressesInstances: { [contractNameSymbol: string]: { [tokenType: string]: string } } = {}

// Update the singleton instance so we don't need to resolve this next time
const updateResolvedAddresses = (addressContractNameSymbol: string, tokenType: AssetAddressTypes, address: string) => {
    if (resolvedAddressesInstances[addressContractNameSymbol]) {
        resolvedAddressesInstances[addressContractNameSymbol][tokenType] = address
    } else {
        resolvedAddressesInstances[addressContractNameSymbol] = { [tokenType]: address }
    }
}

// Resolves a contract name or token symbol to an ethereum address
export const resolveAddress = (
    addressContractNameSymbol: string,
    chain = Chain.mainnet,
    tokenType: AssetAddressTypes = "address",
): string => {
    let address = addressContractNameSymbol
    // If not an Ethereum address
    if (!addressContractNameSymbol.match(ethereumAddress)) {
        // If previously resolved then return from singleton instances
        if (resolvedAddressesInstances[addressContractNameSymbol]?.[tokenType])
            return resolvedAddressesInstances[addressContractNameSymbol][tokenType]

        // If an mStable contract name
        address = getChainAddress(addressContractNameSymbol as ContractNames, chain)

        if (!address) {
            // If a token Symbol
            const token = tokens.find((t) => t.symbol === addressContractNameSymbol && t.chain === chain)
            if (!token) throw Error(`Invalid address, token symbol or contract name "${addressContractNameSymbol}" for chain ${chain}`)
            if (!token[tokenType])
                throw Error(`Can not find token type "${tokenType}" for "${addressContractNameSymbol}" on chain ${chain}`)

            address = token[tokenType]
            console.log(`Resolved asset with symbol "${addressContractNameSymbol}" and type "${tokenType}" to address ${address}`)

            // Update the singleton instance so we don't need to resolve this next time
            updateResolvedAddresses(addressContractNameSymbol, tokenType, address)
            return address
        }

        console.log(`Resolved contract name "${addressContractNameSymbol}" to address ${address}`)

        // Update the singleton instance so we don't need to resolve this next time
        updateResolvedAddresses(addressContractNameSymbol, tokenType, address)

        return address
    }
    return address
}

// Singleton instances of different contract names and token symbols
const resolvedTokenInstances: { [address: string]: { [tokenType: string]: Token } } = {}

export const resolveToken = (symbol: string, chain = Chain.mainnet, tokenType: AssetAddressTypes = "address"): Token => {
    // If previously resolved then return from singleton instances
    if (resolvedTokenInstances[symbol]?.[tokenType]) return resolvedTokenInstances[symbol][tokenType]

    // If a token Symbol
    const token = tokens.find((t) => t.symbol === symbol && t.chain === chain)
    if (!token) throw Error(`Can not find token symbol ${symbol} on chain ${chain}`)
    if (!token[tokenType]) throw Error(`Can not find token type "${tokenType}" for ${symbol} on chain ${chain}`)

    console.log(`Resolved token symbol ${symbol} and type "${tokenType}" to address ${token[tokenType]}`)

    if (resolvedTokenInstances[symbol]) {
        resolvedTokenInstances[symbol][tokenType] = token
    } else {
        resolvedTokenInstances[symbol] = { [tokenType]: token }
    }

    return token
}
