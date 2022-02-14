import { StandardAccounts } from "@utils/machines"
import { simpleToExactAmount } from "@utils/math"

import { ZERO_ADDRESS } from "@utils/constants"
import {
    MockERC20,
    MockERC20__factory,
    MockFulcrum,
    MockFulcrum__factory,
    MockRewardsDistributionRecipient,
    MockRewardsDistributionRecipient__factory,
    MockProtocolFeeCollector,
    MockProtocolFeeCollector__factory,
    RewardsDistributor,
    RewardsDistributor__factory,
} from "types/generated"
import { ethers } from "hardhat"
import { expect } from "chai"
import { BigNumber } from "ethereum-waffle/node_modules/ethers"

describe("RewardsDistributor", async () => {
    let sa: StandardAccounts
    let rewardsDistributor: RewardsDistributor
    let fulcrum: MockFulcrum
    let protocolFeeCollector: MockProtocolFeeCollector

    const redeployProtcolFeeDistributor = async (fulcrumAddress = fulcrum.address): Promise<MockProtocolFeeCollector> =>
    new MockProtocolFeeCollector__factory(sa.fundManager.signer).deploy()

    const redeployRewards = async (fulcrumAddress = fulcrum.address): Promise<RewardsDistributor> =>
    new RewardsDistributor__factory(sa.fundManager.signer).deploy(
        fulcrumAddress, 
        protocolFeeCollector.address, 
        [sa.fundManager.address], 
        [sa.fundManager.address], 
        [sa.fundManager.address], 
        BigNumber.from("0"), 
        BigNumber.from("1000"), 
        BigNumber.from("0")
    )

    before(async () => {
        const accounts = await ethers.getSigners()
        sa = await new StandardAccounts().initAccounts(accounts)
        fulcrum = await new MockFulcrum__factory(sa.default.signer).deploy(
            sa.governor.address
        )

        protocolFeeCollector = await redeployProtcolFeeDistributor()
        rewardsDistributor = await redeployRewards()
    })

    describe("verifying Module initialization", async () => {
        beforeEach(async () => {
            protocolFeeCollector = await redeployProtcolFeeDistributor()
            rewardsDistributor = await redeployRewards()
        })
        it("should emit AddedFundManager on construction", async () => {
            await expect(rewardsDistributor.deployTransaction)
                .to.emit(rewardsDistributor, "AddedFundManager")
                .withArgs(sa.fundManager.address)
        })
        it("should have fund managers initialized", async () => {
            expect(await rewardsDistributor.fulcrum()).eq(fulcrum.address)
            // check Fund Manager accounts
            expect(await rewardsDistributor.fundManagers(sa.fundManager.address), "Fund Manager added").eq(true)
            expect(await rewardsDistributor.fundManagers(sa.default.address), "Default account not fund manager").eq(false)
            expect(await rewardsDistributor.fundManagers(sa.governor.address), "Governor is not a fund manager").eq(false)
        })
    })
    describe("adding FundManagers", async () => {
        beforeEach(async () => {
            protocolFeeCollector = await redeployProtcolFeeDistributor()
            rewardsDistributor = await redeployRewards()
        })
        context("governor trying to add FundManager", async () => {
            it("should add the address to whitelisted", async () => {
                expect(await rewardsDistributor.fundManagers(sa.dummy1.address), "Fund manager before").eq(false)

                const tx = await rewardsDistributor.connect(sa.governor.signer).addFundManager(sa.dummy1.address)
                await expect(tx).to.emit(rewardsDistributor, "AddedFundManager").withArgs(sa.dummy1.address)

                expect(await rewardsDistributor.fundManagers(sa.dummy1.address), "Fund manager after").eq(true)

                const tx2 = rewardsDistributor.connect(sa.governor.signer).addFundManager(sa.dummy1.address)
                await expect(tx2).to.revertedWith("Already fund manager")
            })
            it("should revert if 0 address", async () => {
                expect(await rewardsDistributor.fundManagers(ZERO_ADDRESS), "Before add").eq(false)

                await expect(rewardsDistributor.connect(sa.governor.signer).addFundManager(ZERO_ADDRESS)).to.revertedWith("Address is zero")
            })
        })
        context("non-governor trying to add FundManager", async () => {
            it("should always fail", async () => {
                await expect(rewardsDistributor.connect(sa.default.signer).addFundManager(sa.dummy2.address)).to.revertedWith(
                    "Only governor can execute",
                )
                await expect(rewardsDistributor.connect(sa.dummy1.signer).addFundManager(sa.dummy2.address)).to.revertedWith(
                    "Only governor can execute",
                )
            })
        })
        context("FundManager trying to add FundManager", async () => {
            it("should always fail", async () => {
                expect(await rewardsDistributor.fundManagers(sa.dummy3.address), "Dummy 3 before").eq(false)
                await rewardsDistributor.connect(sa.governor.signer).addFundManager(sa.dummy3.address)
                expect(await rewardsDistributor.fundManagers(sa.dummy3.address), "Dummy 3 after").eq(true)

                await expect(rewardsDistributor.connect(sa.dummy3.signer).addFundManager(sa.dummy1.address)).to.revertedWith(
                    "Only governor can execute",
                )
            })
        })
    })
    describe("removing FundManagers", async () => {
        beforeEach(async () => {
            protocolFeeCollector = await redeployProtcolFeeDistributor()
            rewardsDistributor = await redeployRewards()
        })
        context("governor trying to remove FundManager", async () => {
            it("should remove the address from whitelisted", async () => {
                // Set up the state
                expect(await rewardsDistributor.fundManagers(sa.dummy1.address), "Before add").eq(false)
                await rewardsDistributor.connect(sa.governor.signer).addFundManager(sa.dummy1.address)
                expect(await rewardsDistributor.fundManagers(sa.dummy1.address), "After add").eq(true)

                // Now remove the whitelist
                const tx = await rewardsDistributor.connect(sa.governor.signer).removeFundManager(sa.dummy1.address)
                await expect(tx).to.emit(rewardsDistributor, "RemovedFundManager").withArgs(sa.dummy1.address)

                expect(await rewardsDistributor.fundManagers(sa.dummy1.address), "After remove").eq(false)
            })
            it("should revert if address is not whitelisted", async () => {
                await expect(rewardsDistributor.connect(sa.governor.signer).removeFundManager(sa.dummy1.address)).to.revertedWith(
                    "Not a fund manager",
                )
            })
            it("should revert if 0 address", async () => {
                await expect(rewardsDistributor.connect(sa.governor.signer).removeFundManager(ZERO_ADDRESS)).to.revertedWith(
                    "Address is zero",
                )
            })
        })
        context("non-governor trying to remove FundManager", async () => {
            it("should always fail", async () => {
                await expect(rewardsDistributor.connect(sa.default.signer).removeFundManager(sa.dummy2.address)).to.revertedWith(
                    "Only governor can execute",
                )
                await expect(rewardsDistributor.connect(sa.dummy1.signer).removeFundManager(sa.dummy2.address)).to.revertedWith(
                    "Only governor can execute",
                )
            })
        })
        context("FundManager trying to remove FundManager", async () => {
            it("should always fail", async () => {
                await rewardsDistributor.connect(sa.governor.signer).addFundManager(sa.dummy3.address)
                await rewardsDistributor.connect(sa.governor.signer).addFundManager(sa.dummy4.address)
                expect(await rewardsDistributor.fundManagers(sa.dummy3.address)).eq(true)
                expect(await rewardsDistributor.fundManagers(sa.dummy4.address)).eq(true)

                await expect(rewardsDistributor.connect(sa.dummy4.signer).removeFundManager(sa.dummy3.address)).to.revertedWith(
                    "Only governor can execute",
                )

                await expect(rewardsDistributor.connect(sa.dummy3.signer).removeFundManager(sa.dummy3.address)).to.revertedWith(
                    "Only governor can execute",
                )
            })
        })
    })
    describe("distributing rewards", async () => {
        context("when called by a fundManager", async () => {
            context("and passed invalid args", async () => {
                beforeEach(async () => {
                    protocolFeeCollector = await redeployProtcolFeeDistributor()
                    rewardsDistributor = await redeployRewards()
                })
                it("should fail if arrays are mismatched", async () => {
                    await expect(rewardsDistributor.distributeRewards(sa.dummy1.address, [1, 2], [1])).to.revertedWith(
                        "Mismatching inputs",
                    )
                })
            })
            context("and passed expected args", async () => {
                let rewardToken1: MockERC20
                let rewardToken2: MockERC20
                let stakingToken: MockERC20
                let rewardRecipient1: MockRewardsDistributionRecipient
                beforeEach(async () => {
                    protocolFeeCollector = await redeployProtcolFeeDistributor()

                    rewardToken1 = await new MockERC20__factory(sa.default.signer).deploy("R1", "R1", 18, sa.fundManager.address, 1000000)
                    rewardToken2 = await new MockERC20__factory(sa.default.signer).deploy("R2", "R2", 18, sa.dummy1.address, 1000000)
                    stakingToken = await new MockERC20__factory(sa.default.signer).deploy("K1", "K1", 18, sa.fundManager.address, 1000000)
                    rewardRecipient1 = await new MockRewardsDistributionRecipient__factory(sa.default.signer).deploy(
                        rewardToken1.address
                    )
                    rewardsDistributor = await redeployRewards()
                })
                it("should still notify if amount is 0", async () => {
                    const tx = await rewardsDistributor.distributeRewards(rewardRecipient1.address, [0], [0])
                    await expect(tx)
                        .to.emit(rewardsDistributor, "DistributedReward")
                        .withArgs(rewardRecipient1.address, rewardToken1.address, 0)
                })
                it("should succeed if rewardToken gt 0", async () => {
                    const oneToken = simpleToExactAmount(1, 18)
                    const twoToken = simpleToExactAmount(2, 18)
                    await rewardToken1.connect(sa.fundManager.signer).approve(rewardsDistributor.address, twoToken)
                    // erc balance before
                    const funderBalBefore = await rewardToken1.balanceOf(sa.fundManager.address)
                    const recipient1BalBefore = await rewardToken1.balanceOf(rewardRecipient1.address)

                    // distribute
                    const tx = await rewardsDistributor.distributeRewards(rewardRecipient1.address, [oneToken], [0])

                    await expect(tx)
                        .to.emit(rewardsDistributor, "DistributedReward")
                        .withArgs(rewardRecipient1.address, rewardToken1.address, oneToken)

                    // erc balance after
                    expect(await rewardToken1.balanceOf(sa.fundManager.address), "fund manager balance after").to.eq(
                        funderBalBefore.sub(oneToken),
                    )
                    expect(await rewardToken1.balanceOf(rewardRecipient1.address), "recipient balance after").to.eq(
                        recipient1BalBefore.add(oneToken),
                    )
                })
                it("should transfer the rewardToken to all recipients", async () => {
                    const oneToken = simpleToExactAmount(1, 18)
                    const twoToken = simpleToExactAmount(2, 18)
                    // approve for fund manager
                    await rewardToken1.connect(sa.fundManager.signer).approve(rewardsDistributor.address, twoToken)
                    // erc balance before
                    const funderBalBefore = await Promise.all([
                        rewardToken1.balanceOf(sa.fundManager.address)
                    ])
                    const recipient1BalBefore = await Promise.all([
                        rewardToken1.balanceOf(rewardRecipient1.address)
                    ])

                    // distribute
                    const tx = await rewardsDistributor.distributeRewards(
                        rewardRecipient1.address,
                        [oneToken],
                        [oneToken],
                    )
                    await expect(tx)
                        .to.emit(rewardsDistributor, "DistributedReward")
                        .withArgs(
                            rewardRecipient1.address,
                            rewardToken1.address,
                            oneToken
                        )

                    // erc balance after
                    const funderBalAfter = await Promise.all([
                        rewardToken1.balanceOf(sa.fundManager.address)
                    ])
                    const recipient1BalAfter = await Promise.all([
                        rewardToken1.balanceOf(rewardRecipient1.address)
                    ])
                    // verify balance change
                    expect(funderBalAfter[0]).eq(funderBalBefore[0].sub(oneToken))
                    expect(recipient1BalAfter[0]).eq(recipient1BalBefore[0].add(oneToken))
                })
                it("should fail if funder has insufficient rewardToken balance", async () => {
                    const oneToken = simpleToExactAmount(1, 18)
                    await rewardToken2.connect(sa.fundManager.signer).approve(rewardsDistributor.address, oneToken)
                    const funderBalBefore = await rewardToken2.balanceOf(sa.fundManager.address)
                    expect(funderBalBefore, "Funder bal before").eq(0)
                    await expect(rewardsDistributor.distributeRewards(rewardRecipient1.address, [oneToken], [oneToken])).to.revertedWith(
                        "ERC20: transfer amount exceeds allowance",
                    )
                })
                it("should fail if sender doesn't give approval", async () => {
                    const oneToken = simpleToExactAmount(1, 18)
                    const funderBalBefore = await Promise.all([
                        rewardToken1.balanceOf(sa.fundManager.address)
                    ])
                    expect(funderBalBefore[0], "Funder reward bal before").gte(oneToken)
                    await expect(
                        rewardsDistributor.distributeRewards(
                            rewardRecipient1.address,
                            [oneToken, oneToken],
                            [oneToken, oneToken],
                        ),
                    ).to.revertedWith("ERC20: transfer amount exceeds allowance")
                })
                it("should fail if recipient doesn't implement IRewardsDistributionRecipient interface", async () => {
                    const oneToken = simpleToExactAmount(1, 18)
                    await rewardToken1.approve(rewardsDistributor.address, oneToken)
                    const funderBalBefore = await rewardToken1.balanceOf(sa.fundManager.address)
                    expect(funderBalBefore, "Funder reward bal before").gte(oneToken)
                    await expect(rewardsDistributor.distributeRewards(sa.dummy1.address, [oneToken], [oneToken])).to.revertedWith("")
                })
            })
            context("and passed valid array with duplicate address", async () => {
                let rewardToken1: MockERC20
                let rewardRecipient1: MockRewardsDistributionRecipient
                beforeEach(async () => {
                    rewardToken1 = await new MockERC20__factory(sa.fundManager.signer).deploy(
                        "R1",
                        "R1",
                        18,
                        sa.fundManager.address,
                        1000000,
                    )
                    rewardRecipient1 = await new MockRewardsDistributionRecipient__factory(sa.default.signer).deploy(
                        rewardToken1.address
                    )
                    protocolFeeCollector = await redeployProtcolFeeDistributor()
                    rewardsDistributor = await redeployRewards()
                })
            })
            context("and passed some null addresses", async () => {
                let rewardToken1: MockERC20
                let rewardRecipient1: MockRewardsDistributionRecipient
                beforeEach(async () => {
                    rewardToken1 = await new MockERC20__factory(sa.fundManager.signer).deploy(
                        "R1",
                        "R1",
                        18,
                        sa.fundManager.address,
                        1000000,
                    )
                    rewardRecipient1 = await new MockRewardsDistributionRecipient__factory(sa.default.signer).deploy(
                        rewardToken1.address
                    )
                    protocolFeeCollector = await redeployProtcolFeeDistributor()
                    rewardsDistributor = await redeployRewards()
                })
                it("should fail", async () => {
                    const oneToken = simpleToExactAmount(1, 18)
                    const twoToken = simpleToExactAmount(2, 18)
                    await rewardToken1.approve(rewardsDistributor.address, twoToken)
                    const funderBalBefore = await Promise.all([
                        rewardToken1.balanceOf(sa.fundManager.address)
                    ])
                    expect(funderBalBefore[0]).gte(simpleToExactAmount(2, 18))
                    await expect(
                        rewardsDistributor.distributeRewards(
                            rewardRecipient1.address,
                            [oneToken, oneToken],
                            [oneToken, oneToken],
                        ),
                    ).to.revertedWith("")
                })
            })
        })
        context("when called by other", async () => {
            it("should not allow governor to distribute", async () => {
                await expect(
                    rewardsDistributor.connect(sa.governor.signer).distributeRewards(sa.default.address, [1], [1]),
                ).to.revertedWith("Not a fund manager")
            })
            it("should not allow old fund managers to distribute", async () => {
                await rewardsDistributor.connect(sa.governor.signer).removeFundManager(sa.fundManager.address)
                expect(await rewardsDistributor.fundManagers(sa.fundManager.address)).eq(false)
                await expect(rewardsDistributor.distributeRewards(sa.default.address, [1], [1])).to.revertedWith("Not a fund manager")
            })
            it("should not allow others to distribute", async () => {
                await expect(rewardsDistributor.connect(sa.dummy1.signer).distributeRewards(sa.default.address, [1], [1])).revertedWith(
                    "Not a fund manager",
                )
                await expect(
                    rewardsDistributor.connect(sa.default.signer).distributeRewards(sa.default.address, [1], [1]),
                ).to.revertedWith("Not a fund manager")
            })
        })
    })
})
