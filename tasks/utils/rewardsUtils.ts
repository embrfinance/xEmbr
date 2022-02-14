import { BigNumberish } from "@ethersproject/bignumber"
import { Contract } from "@ethersproject/contracts"
import { formatBytes32String } from "@ethersproject/strings"
import { Signer } from "ethers"
import { Account } from "types/common"
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime"
import {
    AssetProxy__factory,
    InstantProxyAdmin__factory,
    QuestManager__factory,
    SignatureVerifier__factory,
    XEmbrToken__factory
} from "types/generated"
import { deployContract } from "./deploy-utils"
import { verifyEtherscan } from "./etherscan"
import { getChain, getChainAddress, resolveAddress } from "./networkAddressFactory"

export interface StakedTokenData {
    stakingToken: string
    cooldown: BigNumberish
    unstakeWindow: BigNumberish
    name: string
    symbol: string
}

export interface StakedTokenDeployAddresses {
    stakedToken?: string
    questManager?: string
    signatureVerifier?: string
    proxyAdminAddress?: string
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const sleepTime = 20000 // milliseconds

export const deployStakingToken = async (
    stakedTokenData: StakedTokenData,
    deployer: Account,
    hre: HardhatRuntimeEnvironment,
    deployProxy = false,
    overrides?: StakedTokenDeployAddresses,
    overrideSigner?: string,
): Promise<StakedTokenDeployAddresses> => {
    const chain = getChain(hre)

    const fulcrumAddress = resolveAddress("Fulcrum", chain)
    const rewardsDistributorAddress = resolveAddress("RewardsDistributor", chain)
    const questMasterAddress = resolveAddress("QuestMaster", chain)
    const questSignerAddress = overrideSigner ?? resolveAddress("QuestSigner", chain)
    const delayedProxyAdminAddress = resolveAddress("DelayedProxyAdmin", chain)

    let proxyAdminAddress = getChainAddress("ProxyAdmin", chain)
    if (!proxyAdminAddress) {
    //    const proxyAdmin = await deployContract(new InstantProxyAdmin__factory(deployer.signer), "InstantProxyAdmin")
    //    await sleep(sleepTime)
    //    await proxyAdmin.transferOwnership(resolveAddress("ProtocolDAO", chain), {nonce: 234})
    //    proxyAdminAddress = proxyAdmin.address
    }

    let signatureVerifierAddress = overrides?.signatureVerifier ?? getChainAddress("SignatureVerifier", chain)
    if (!signatureVerifierAddress) {
        const signatureVerifier = await deployContract(new SignatureVerifier__factory(deployer.signer), "SignatureVerifier")
        signatureVerifierAddress = signatureVerifier.address

        await verifyEtherscan(hre, {
            address: signatureVerifierAddress,
            contract: "contracts/governance/staking/deps/SignatureVerifier.sol:SignatureVerifier",
        })
    }
    //await sleep(sleepTime)

    let questManagerAddress = overrides?.questManager ?? getChainAddress("QuestManager", chain)
    if (!questManagerAddress) {
        const questManagerLibraryAddresses = {
            "contracts/governance/staking/deps/SignatureVerifier.sol:SignatureVerifier": signatureVerifierAddress,
        }
        const questManagerImpl = await deployContract(
            new QuestManager__factory(questManagerLibraryAddresses, deployer.signer),
            "QuestManager",
            [fulcrumAddress],
        )
        const data = questManagerImpl.interface.encodeFunctionData("initialize", [questMasterAddress, questSignerAddress])

        await verifyEtherscan(hre, {
            address: questManagerImpl.address,
            contract: "contracts/governance/staking/QuestManager.sol:QuestManager",
            constructorArguments: [fulcrumAddress],
            libraries: {
                SignatureVerifier: signatureVerifierAddress,
            },
        })

        const constructorArguments = [questManagerImpl.address, delayedProxyAdminAddress, data]
        const questManagerProxy = await deployContract(new AssetProxy__factory(deployer.signer), "AssetProxy", constructorArguments)
        questManagerAddress = questManagerProxy.address
    }
    //await sleep(sleepTime)

    let constructorArguments: [string,string,BigNumberish, BigNumberish, BigNumberish, boolean]
    let stakedTokenImpl: Contract
    let data: string
    constructorArguments = [
        fulcrumAddress,
        questManagerAddress,
        stakedTokenData.stakingToken,
        stakedTokenData.cooldown,
        stakedTokenData.unstakeWindow,
        false
    ]

    stakedTokenImpl = await deployContract(
        new XEmbrToken__factory(deployer.signer),
        "XEmbrToken",
        constructorArguments,
    )
    console.log("rewar address", rewardsDistributorAddress)
    data = stakedTokenImpl.interface.encodeFunctionData("__xEmbrToken_init", [
        formatBytes32String(stakedTokenData.name),
        formatBytes32String(stakedTokenData.symbol),
        rewardsDistributorAddress,
    ])
    

    await verifyEtherscan(hre, {
        address: stakedTokenImpl.address,
        constructorArguments
    })

    let proxy: Contract
    if (deployProxy) {
        proxy = await deployContract(new AssetProxy__factory(deployer.signer), "AssetProxy", [
            stakedTokenImpl.address,
            proxyAdminAddress,
            data,
        ])
    }

    return {
        stakedToken: proxy?.address,
        questManager: questManagerAddress,
        signatureVerifier: signatureVerifierAddress,
        proxyAdminAddress,
    }
}