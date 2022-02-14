import { Contract, ContractFactory, ContractReceipt, ContractTransaction, Overrides } from "ethers"
import { formatUnits } from "@ethersproject/units"
import debug from "debug"

export const deployContract = async <T extends Contract>(
    contractFactory: ContractFactory,
    contractName = "Contract",
    constructorArgs: Array<unknown> = [],
    overrides: Overrides = {},
): Promise<T> => {
    const contract = (await contractFactory.deploy(...constructorArgs, overrides)) as T
    console.log(
        `Deploying ${contractName} contract with hash ${contract.deployTransaction.hash} from ${
            contract.deployTransaction.from
        }`,
    )
    const receipt = await contract.deployTransaction.wait()
    const abiEncodedConstructorArgs = contract.interface.encodeDeploy(constructorArgs)
    console.log(
        `Deployed ${contractName} to ${contract.address} in block ${receipt.blockNumber}`,
    )
    console.log(`ABI encoded args: ${abiEncodedConstructorArgs.slice(2)}`)
    return contract
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const logger = (...args: string[]) => debug(`mstable:task:${args.join(":")}`)

export const logTxDetails = async (tx: ContractTransaction, method: string): Promise<ContractReceipt> => {
    console.log(`Sent ${method} transaction with hash ${tx.hash} from ${tx.from}`)
    const receipt = await tx.wait()

    // Calculate tx cost in Wei
    console.log(`Processed ${method} tx in block ${receipt.blockNumber}`)

    return receipt
}
