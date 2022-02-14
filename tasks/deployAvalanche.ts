/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import "ts-node/register"
import "tsconfig-paths/register"
import { task, types } from "hardhat/config"
import {
    DelayedProxyAdmin,
    DelayedProxyAdmin__factory,
    Fulcrum,
    Fulcrum__factory,
    RewardsDistributor,
    RewardsDistributor__factory
} from "types/generated"
import { DEAD_ADDRESS, KEY_LIQUIDATOR, KEY_PROXY_ADMIN, KEY_REWARD_DISTRBUTOR, ONE_DAY, ZERO_ADDRESS } from "@utils/constants"
import { BN, simpleToExactAmount } from "@utils/math"
import { formatUnits } from "@ethersproject/units"
import { Signer, BigNumberish } from "ethers"
import { deployContract, logTxDetails } from "./utils/deploy-utils"
import { getSigner } from "./utils/signerFactory"
import { getChain, getChainAddress } from "./utils/networkAddressFactory"
import { verifyEtherscan } from "./utils/etherscan"


// FIXME: this import does not work for some reason
// import { sleep } from "@utils/time"
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const sleepTime = 10000 // milliseconds

task("deploy-avalanche", "Deploys xEmbr & System to a avalanche network")
    .addOptionalParam("speed", "Defender Relayer speed param: 'safeLow' | 'average' | 'fast' | 'fastest'", "fast", types.string)
    .addOptionalParam("pfc", "Address of protocol fee collector", "", types.string)
    .setAction(async (taskArgs, hre) => {
        const { network } = hre
        const signer = await getSigner(hre, taskArgs.speed)
        const chain = getChain(hre)
        const signerAddress = await signer.getAddress()

        // Deploy Fulcrum
        const fulcrum = await deployContract<Fulcrum>(new Fulcrum__factory(signer), "Fulcrum", [signerAddress])

       /* await verifyEtherscan(hre, {
            address: fulcrum.address,
            contract: "contracts/fulcrum/Fulcrum.sol:Fulcrum",
            constructorArguments: [signerAddress],
        })*/


        // Deploy DelayedProxyAdmin
        const delayedProxyAdmin = await deployContract<DelayedProxyAdmin>(new DelayedProxyAdmin__factory(signer), "DelayedProxyAdmin", [
            fulcrum.address,
        ])

       /* await verifyEtherscan(hre, {
            address: delayedProxyAdmin.address,
            contract: "contracts/upgradability/DelayedProxyAdmin.sol:DelayedProxyAdmin",
            constructorArguments: [fulcrum.address],
        })
        */

        await sleep(sleepTime)

        let multiSigAddress: string
        multiSigAddress = signerAddress

        await sleep(sleepTime)

        //const fundManagerAddress = getChainAddress("FundManager", chain)
        //const governorAddress = getChainAddress("Governor", chain)
        //const nexusAddress = getChainAddress("Nexus", chain)

         // Deploy Savings Manager
         const rewardDistrubutorManager = await deployContract(new RewardsDistributor__factory(signer), "RewardsDistributor", [
            fulcrum.address,
            "0x1916a95d7ed0079ed4d58607ab891c1b60f26b14", 
            [signerAddress], 
            [signerAddress], 
            [signerAddress], 
            BN.from("0"), 
            BN.from("1000"), 
            BN.from("0")
        ])

        await verifyEtherscan(hre, {
            address: rewardDistrubutorManager.address,
            contract: "contracts/rewards/RewardsDistributor.sol:RewardsDistributor",
            constructorArguments: [
                fulcrum.address, "0x1916a95d7ed0079ed4d58607ab891c1b60f26b14", 
                [signerAddress], 
                [signerAddress], 
                [signerAddress],  
                BN.from("0"), 
                BN.from("1000"), 
                BN.from("0")]
        })

        await sleep(sleepTime)

        // Initialize Fulcrum Modules
        const moduleKeys = [KEY_REWARD_DISTRBUTOR, KEY_PROXY_ADMIN]
        const moduleAddresses = [rewardDistrubutorManager.address, delayedProxyAdmin.address]
        const moduleIsLocked = [false, true]
        const fulcrumTx = await fulcrum.connect(signer).initialize(moduleKeys, moduleAddresses, moduleIsLocked, multiSigAddress)
        const fulcrumReceipt = await fulcrumTx.wait()
        console.log(`Fulcrum initialize status ${fulcrumReceipt.status} from receipt`)
    })
    

module.exports = {}