import "ts-node/register"
import "tsconfig-paths/register"
import { subtask, task, types } from "hardhat/config"
import { ONE_WEEK, ONE_HOUR } from "@utils/constants"
import { getSignerAccount, getSigner } from "./utils/signerFactory"
import { deployStakingToken, StakedTokenData } from "./utils/rewardsUtils"
import { getChain, resolveAddress } from "./utils/networkAddressFactory"
import {
    RewardsDistributor__factory
} from "types/generated"
import { logTxDetails } from "./utils/deploy-utils"


task("xEmbr.deploy", "Deploys xEmbr behind a proxy")
    .addOptionalParam("embr", "address of the staking token.", "0x6036617225ded90fCD43cb20731D0E41BcF4e3f0", types.string)
    .addOptionalParam("stakedToken", "Symbol of staked token.", "xEMBR", types.string)
    .addOptionalParam("name", "Staked Token name", "xEmbr", types.string)
    .addOptionalParam("symbol", "Staked Token symbol", "xEMBR", types.string)
    .addOptionalParam("cooldown", "Number of seconds for the cooldown period", ONE_WEEK.toNumber(), types.int)
    .addOptionalParam("unstakeWindow", "Number of seconds for the unstake window", ONE_WEEK.mul(2).toNumber(), types.int)
    .addOptionalParam("proxy", "Deploys a proxy contract", false, types.boolean)
    .setAction(async (taskArgs, hre) => {
        const deployer = await getSignerAccount(hre, taskArgs.speed)

        const stakingTokenData: StakedTokenData = {
            stakingToken: "0x6036617225ded90fCD43cb20731D0E41BcF4e3f0",
            cooldown:  ONE_HOUR.mul(2).toNumber(),
            unstakeWindow:  ONE_WEEK.mul(2).toNumber(),
            name: "xEmbr",
            symbol: "xEMBR",
        }
        await deployStakingToken(stakingTokenData, deployer, hre, taskArgs.proxy)
    })

subtask("add-reward-token", "Add new reward token to the reward distrubutor")
    .addParam("rewardToken", "Amount to of token to be staked without the token decimals.", undefined, types.string)
    .addOptionalParam("speed", "Defender Relayer speed param: 'safeLow' | 'average' | 'fast' | 'fastest'", "average", types.string)
    .setAction(async (taskArgs, hre) => {
        const signer = await getSigner(hre, taskArgs.speed, false)
        const chain = getChain(hre)

        const rewardDistrubutorManager = resolveAddress("RewardsDistributor", chain)
        const xEmbrAddress = resolveAddress("xEmbrToken", chain)
        const rewardDistrbutor = RewardsDistributor__factory.connect(rewardDistrubutorManager, signer)

        const tx = await rewardDistrbutor.addRewardToken(xEmbrAddress, taskArgs.rewardToken)

        await logTxDetails(tx, `Added new reward token ${taskArgs.rewardToken}`)
    })
task("add-reward-token").setAction(async (_, __, runSuper) => {
    await runSuper()
})
    

export {}