import { expect } from "chai"
import { keccak256, toUtf8Bytes, hexlify } from "ethers/lib/utils"
import { ethers } from "hardhat"
import { xEmbrMachine, StandardAccounts } from "@utils/machines"
import { BN } from "@utils/math"
import { DelayedClaimableGovernor, Fulcrum, Fulcrum__factory } from "types/generated"
import { getTimestamp, increaseTime } from "@utils/time"
import { ONE_WEEK, ZERO_ADDRESS, KEY_REWARD_DISTRBUTOR, ONE_DAY, ZERO, ZERO_KEY } from "@utils/constants"
import { shouldBehaveLikeDelayedClaimable, IGovernableBehaviourContext } from "../governance/DelayedClaimableGovernor.behaviour"
import { shouldBehaveLikeClaimable } from "../governance/ClaimableGovernor.behaviour"

/** @dev Uses generic module getter to validate that a module exists with the specified properties */
async function expectInModules(fulcrum: Fulcrum, _key: string, _addr: string, _isLocked: boolean): Promise<void> {
    /* eslint-disable prefer-const */
    let addr: string
    let isLocked: boolean
    const encodedKey = keccak256(toUtf8Bytes(_key))
    ;[addr, isLocked] = await fulcrum.modules(encodedKey)
    expect(addr, "Module address not matched").to.equal(_addr)
    expect(isLocked, "Module isLocked not matched").to.equal(_isLocked)
    const exists = await fulcrum.moduleExists(encodedKey)
    if (addr !== ZERO_ADDRESS) {
        expect(exists, "moduleExists true").to.equal(true)
    } else {
        expect(exists, "moduleExists false").to.equal(false)
    }
    expect(await fulcrum.getModule(encodedKey), "getModule").to.eq(_addr)
}

async function expectInProposedModules(fulcrum: Fulcrum, _key: string, _newAddress: string, _timestamp: BN): Promise<void> {
    let newAddress: string
    let timestamp: BN
    ;[newAddress, timestamp] = await fulcrum.proposedModules(keccak256(toUtf8Bytes(_key)))
    /* eslint-enable prefer-const */
    expect(newAddress, "New address not matched in proposed modules").to.equal(_newAddress)
    expect(timestamp, "The timestamp not matched in proposed modules").to.equal(_timestamp)
}

async function expectInProposedLockModules(fulcrum: Fulcrum, _key: string, _timestamp: BN): Promise<void> {
    const timestamp: BN = await fulcrum.proposedLockModules(keccak256(toUtf8Bytes(_key)))
    expect(timestamp, "The timestamp not matched in proposed lock modules").to.equal(_timestamp)
}

async function deployFulcrum(sa: StandardAccounts): Promise<Fulcrum> {
    return new Fulcrum__factory(sa.governor.signer).deploy(sa.governor.address)
}

describe("Fulcrum", () => {
    let sa: StandardAccounts
    let fulcrum: Fulcrum

    describe("Behavior like...", () => {
        const ctx: Partial<IGovernableBehaviourContext> = {}
        before(async () => {
            const accounts = await ethers.getSigners()
            const xembrMachine = await new xEmbrMachine().initAccounts(accounts)
            sa = xembrMachine.sa
            ctx.default = sa.default
            ctx.governor = sa.governor
            ctx.other = sa.other
        })
        beforeEach("Init contract", async () => {
            ctx.claimable = (await deployFulcrum(sa)) as DelayedClaimableGovernor
        })
        context("should behave like ClaimableGovernor", () => {
            shouldBehaveLikeClaimable(ctx as Required<typeof ctx>)
        })

        context("should behave like DelayedClaimableGovernor", () => {
            beforeEach("", async () => {
                const { other } = sa
                await ctx.claimable.connect(sa.governor.signer).requestGovernorChange(other.address)
            })

            shouldBehaveLikeDelayedClaimable(ctx as Required<typeof ctx>)
        })
    })

    describe("Before initialize", () => {
        it("should have correct default parameters", async () => {
            // Deploy new fulcrum
            fulcrum = await deployFulcrum(sa)
            const governor = await fulcrum.governor()
            const initialized = await fulcrum.initialized()
            const upgradeDelay = await fulcrum.UPGRADE_DELAY()
            expect(governor).to.equal(sa.governor.address)
            expect(initialized).to.equal(false)
            expect(upgradeDelay).to.equal(ONE_WEEK)
        })
    })

    describe("initialize()", () => {
        beforeEach("deploy fulcrum instance", async () => {
            // Deploy new fulcrum, to override
            fulcrum = await deployFulcrum(sa)
        })
        context("should succeed", () => {
            it("with default modules", async () => {
                await fulcrum.initialize([KEY_REWARD_DISTRBUTOR], [sa.mockRewardsDistributor.address], [false], sa.governor.address)
                // initialized
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)

                // validate modules
                await expectInModules(fulcrum, "RewardsDistributor", sa.mockRewardsDistributor.address, false)
            })
            it("when current governor called the function", async () => {
                await fulcrum
                    .connect(sa.governor.signer)
                    .initialize([keccak256(toUtf8Bytes("dummy1"))], [sa.dummy1.address], [true], sa.governor.address)
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, true)
            })
            it("when different governor address passed", async () => {
                const govBefore = await fulcrum.governor()
                await fulcrum
                    .connect(sa.governor.signer)
                    .initialize([keccak256(toUtf8Bytes("dummy"))], [sa.default.address], [true], sa.other.address)
                await expectInModules(fulcrum, "dummy", sa.default.address, true)
                const govAfter = await fulcrum.governor()
                expect(govBefore).to.not.equal(govAfter)
                expect(govBefore).to.equal(sa.governor.address)
                expect(govAfter).to.equal(sa.other.address)
            })
        })
        context("should fail", () => {
            it("when called by other than governor", async () => {
                await expect(fulcrum.connect(sa.default.signer).initialize([], [], [], sa.governor.address)).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when initialized with same address for different modules", async () => {
                await expect(
                    fulcrum
                        .connect(sa.governor.signer)
                        .initialize(
                            [keccak256(toUtf8Bytes("dummy1")), keccak256(toUtf8Bytes("dummy2"))],
                            [sa.dummy1.address, sa.dummy1.address],
                            [false, false],
                            sa.governor.address,
                        ),
                ).to.be.revertedWith("Modules must have unique addr")
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)
                await expectInModules(fulcrum, "dummy2", ZERO_ADDRESS, false)
            })
            it("when initialized with an empty array", async () => {
                await expect(fulcrum.connect(sa.governor.signer).initialize([], [], [], sa.governor.address)).to.be.revertedWith(
                    "No keys provided",
                )
            })
            it("when initialized with wrong array length for addresses array", async () => {
                await expect(
                    fulcrum
                        .connect(sa.governor.signer)
                        .initialize([keccak256(toUtf8Bytes("dummy"))], [sa.default.address, sa.other.address], [true], sa.governor.address),
                ).to.be.revertedWith("Insufficient address data")
                await expectInModules(fulcrum, "dummy", ZERO_ADDRESS, false)
            })
            it("when initialized with wrong array length for isLocked array", async () => {
                await expect(
                    fulcrum
                        .connect(sa.governor.signer)
                        .initialize([keccak256(toUtf8Bytes("dummy"))], [sa.default.address], [true, false], sa.governor.address),
                ).to.be.revertedWith("Insufficient locked statuses")
                await expectInModules(fulcrum, "dummy", ZERO_ADDRESS, false)
            })

            it("when already initialized", async () => {
                await fulcrum
                    .connect(sa.governor.signer)
                    .initialize([keccak256(toUtf8Bytes("dummy1"))], [sa.dummy1.address], [true], sa.governor.address)
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, true)
                // must fail
                await expect(
                    fulcrum
                        .connect(sa.governor.signer)
                        .initialize([keccak256(toUtf8Bytes("dummy"))], [sa.default.address], [true], sa.governor.address),
                ).to.be.revertedWith("Fulcrum is already initialized")
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, true)
            })
        })
    })

    beforeEach("Init contract", async () => {
        fulcrum = await deployFulcrum(sa)
        await fulcrum
            .connect(sa.governor.signer)
            .initialize(
                [keccak256(toUtf8Bytes("dummy3")), keccak256(toUtf8Bytes("dummy4"))],
                [sa.dummy3.address, sa.dummy4.address],
                [true, false],
                sa.governor.address,
            )
        await expectInModules(fulcrum, "dummy3", sa.dummy3.address, true)
        await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)
    })

    describe("proposeModule()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by Governor", async () => {
                await expect(
                    fulcrum.connect(sa.other.signer).proposeModule(keccak256(toUtf8Bytes("dummy")), sa.default.address),
                ).to.be.revertedWith("GOV: caller is not the Governor")
                await expectInProposedModules(fulcrum, "dummy", ZERO_ADDRESS, ZERO)
            })
            it("when empty key", async () => {
                await expect(fulcrum.connect(sa.governor.signer).proposeModule(ZERO_KEY, sa.default.address)).to.be.revertedWith(
                    "Key must not be zero",
                )
                await expectInProposedModules(fulcrum, ZERO_KEY, ZERO_ADDRESS, ZERO)
            })
            it("when zero address", async () => {
                await expect(
                    fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy")), ZERO_ADDRESS),
                ).to.be.revertedWith("Module address must not be 0")
                await expectInProposedModules(fulcrum, "dummy", ZERO_ADDRESS, ZERO)
            })
            it("when module key & address are same", async () => {
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)
                await expect(
                    fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy4")), sa.dummy4.address),
                ).to.be.revertedWith("Module already has same address")
                await expectInProposedModules(fulcrum, "dummy4", ZERO_ADDRESS, ZERO)
            })
            it("when module is locked (update for existing module)", async () => {
                await expectInModules(fulcrum, "dummy3", sa.dummy3.address, true)
                await expect(
                    fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy3")), sa.other.address),
                ).to.be.revertedWith("Module must be unlocked")
                await expectInProposedModules(fulcrum, "dummy3", ZERO_ADDRESS, ZERO)
            })
            it("when module already proposed", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy2")), sa.dummy2.address)
                const timestamp = await getTimestamp()
                await expectInProposedModules(fulcrum, "dummy2", sa.dummy2.address, timestamp)

                await expect(
                    fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy2")), sa.dummy3.address),
                ).to.be.revertedWith("Module already proposed")
                await expectInProposedModules(fulcrum, "dummy2", sa.dummy2.address, timestamp)
            })
        })
        context("should succeed", () => {
            it("when a new module is proposed", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                const lastTimestamp = await getTimestamp()

                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, lastTimestamp)
            })
            it("when an existing module address is updated", async () => {
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)

                // propose new address
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy4")), sa.other.address)
                const lastTimestamp = await getTimestamp()

                await expectInProposedModules(fulcrum, "dummy4", sa.other.address, lastTimestamp)

                // address is not updated in modules mapping
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)
            })
        })
    })

    describe("cancelProposedModule()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by Governor", async () => {
                await expect(fulcrum.connect(sa.other.signer).cancelProposedModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when proposed module not found", async () => {
                await expect(fulcrum.connect(sa.governor.signer).cancelProposedModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "Proposed module not found",
                )
            })
        })
        context("should succeed", () => {
            it("when cancelling existing proposed module", async () => {
                // propose a new module
                // =====================
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                // validate proposed module

                // validate dummy1 added
                const latestTimestamp = await getTimestamp()
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, latestTimestamp)

                // validate dummy3 still exist
                await expectInModules(fulcrum, "dummy3", sa.dummy3.address, true)

                // cancel the module
                // ==================
                const tx = fulcrum.connect(sa.governor.signer).cancelProposedModule(keccak256(toUtf8Bytes("dummy1")))
                // expect event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleCancelled")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy1"))))

                // validate cancelled
                await expectInProposedModules(fulcrum, "dummy1", ZERO_ADDRESS, ZERO)

                // validate dummy3 still exist
                await expectInModules(fulcrum, "dummy3", sa.dummy3.address, true)
            })
        })
    })

    describe("acceptProposedModule()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by Governor", async () => {
                await expect(fulcrum.connect(sa.other.signer).acceptProposedModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when non existing key passed", async () => {
                await expect(fulcrum.connect(sa.governor.signer).acceptProposedModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "Module upgrade delay not over",
                )
            })
            it("when delay not over", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                const timeWhenModuleProposed = await getTimestamp()
                await increaseTime(ONE_DAY)
                await expect(fulcrum.connect(sa.governor.signer).acceptProposedModule(keccak256(toUtf8Bytes("dummy1")))).to.be.revertedWith(
                    "Module upgrade delay not over",
                )

                // validate
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, timeWhenModuleProposed)

                // validate module still not accepted
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)
            })
        })
        context("should succeed", () => {
            it("when accepted after delay is over", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                const timeWhenModuleProposed = await getTimestamp()

                // validate
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, timeWhenModuleProposed)

                await increaseTime(ONE_WEEK)
                await fulcrum.connect(sa.governor.signer).acceptProposedModule(keccak256(toUtf8Bytes("dummy1")))

                // validate module accepted
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, false)

                // validate data deleted from proposedModules map
                await expectInProposedModules(fulcrum, "dummy1", ZERO_ADDRESS, ZERO)
            })
        })
    })

    describe("acceptProposedModules()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by Governor", async () => {
                await expect(fulcrum.connect(sa.other.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy"))])).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when empty array", async () => {
                await expect(fulcrum.connect(sa.governor.signer).acceptProposedModules([])).to.be.revertedWith("Keys array empty")
            })
            it("when non existing key passed", async () => {
                await expect(fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy"))])).to.be.revertedWith(
                    "Module upgrade delay not over",
                )
            })
            it("when module not proposed", async () => {
                await expect(
                    fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy1"))]),
                ).to.be.revertedWith("Module upgrade delay not over")
            })
            it("when module is locked", async () => {
                // update address request
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy4")), sa.other.address)
                const timestampWhenProposed = await getTimestamp()
                await expectInProposedModules(fulcrum, "dummy4", sa.other.address, timestampWhenProposed)
                await increaseTime(ONE_DAY)
                // lock request
                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await expectInProposedLockModules(fulcrum, "dummy4", await getTimestamp())

                await increaseTime(ONE_WEEK)
                // module locked
                await fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy4")))
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, true)

                // now accpet update request - must fail
                await expect(
                    fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy4"))]),
                ).to.be.revertedWith("Module must be unlocked")
                await expectInProposedModules(fulcrum, "dummy4", sa.other.address, timestampWhenProposed)
            })
            it("when address is already used by another module", async () => {
                // proposed new module - dummy1
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, await getTimestamp())

                // propose new module - dummy2 with dummy1 as address
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy2")), sa.dummy1.address)
                await expectInProposedModules(fulcrum, "dummy2", sa.dummy1.address, await getTimestamp())

                await increaseTime(ONE_WEEK)

                // dummy1 accepted
                await fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy1"))])
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, false)

                // dummy2 must be rejected
                await expect(
                    fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy2"))]),
                ).to.be.revertedWith("Modules must have unique addr")
            })
            it("when delay is not over", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await increaseTime(ONE_DAY)
                await expect(
                    fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy1"))]),
                ).to.be.revertedWith("Module upgrade delay not over")

                // not present in modules
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)
            })
            it("when delay is less then 10 second of opt out period", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await increaseTime(ONE_WEEK.sub(BN.from(10)))
                await expect(
                    fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy1"))]),
                ).to.be.revertedWith("Module upgrade delay not over")

                // not present in modules
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)
            })
        })
        context("should succeed", () => {
            it("when accepted a proposed Module", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await increaseTime(ONE_WEEK)
                const tx = fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy1"))])

                // validate event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleAdded")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy1"))), sa.dummy1.address, false)

                // validate - added in "modules" mapping
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, false)

                // validate - removed from "proposedModules" mapping
                await expectInProposedModules(fulcrum, "dummy1", ZERO_ADDRESS, ZERO)
            })
            it("when delay is more then 10 second of opt out period", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await increaseTime(ONE_WEEK.add(BN.from(10)))
                const tx = fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy1"))])

                // validate event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleAdded")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy1"))), sa.dummy1.address, false)
            })
            it("when module address update request accepted", async () => {
                // validate - existing module present in "modules" mapping
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)

                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy4")), sa.other.address)

                await increaseTime(ONE_WEEK)

                const tx = fulcrum.connect(sa.governor.signer).acceptProposedModules([keccak256(toUtf8Bytes("dummy4"))])

                // validate event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleAdded")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy4"))), sa.other.address, false)

                // validate - added in "modules" mapping
                await expectInModules(fulcrum, "dummy4", sa.other.address, false)

                // validate - removed from "proposedModules" mapping
                await expectInProposedModules(fulcrum, "dummy4", ZERO_ADDRESS, ZERO)
            })
        })
    })

    describe("requestLockModule()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by the Governor", async () => {
                await expect(fulcrum.connect(sa.other.signer).requestLockModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when module not exist", async () => {
                await expect(fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "Module must exist",
                )
            })
            it("when module key is zero", async () => {
                await expect(fulcrum.connect(sa.governor.signer).requestLockModule(ZERO_KEY)).to.be.revertedWith("Module must exist")
            })
            it("when module already locked", async () => {
                await expect(fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy3")))).to.be.revertedWith(
                    "Module must be unlocked",
                )
            })
            it("when locked already proposed", async () => {
                // lock proposed
                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await expect(fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))).to.be.revertedWith(
                    "Lock already proposed",
                )
            })
        })
        context("should succeed", () => {
            it("when a fresh lock request initiated", async () => {
                // lock proposed
                const latestTimestamp = await getTimestamp()
                const tx = fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await expect(tx)
                    .to.emit(fulcrum, "ModuleLockRequested")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy4"))), latestTimestamp.add(1))
                const requestTimestamp = await fulcrum.proposedLockModules(keccak256(toUtf8Bytes("dummy4")))
                expect(requestTimestamp).to.equal(latestTimestamp.add(1))
            })
        })
    })

    describe("cancelLockModule()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by Governor", async () => {
                await expect(fulcrum.connect(sa.other.signer).cancelLockModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when not proposed lock before", async () => {
                await expect(fulcrum.connect(sa.governor.signer).cancelLockModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "Module lock request not found",
                )
            })
            it("when zero key", async () => {
                await expect(fulcrum.connect(sa.governor.signer).cancelLockModule(ZERO_KEY)).to.be.revertedWith(
                    "Module lock request not found",
                )
            })
            it("when lock request not found", async () => {
                await expect(fulcrum.connect(sa.governor.signer).cancelLockModule(keccak256(toUtf8Bytes("dummy4")))).to.be.revertedWith(
                    "Module lock request not found",
                )
            })
        })
        context("should succeed", () => {
            it("when a valid cancel lock request", async () => {
                await expectInProposedLockModules(fulcrum, "dummy4", ZERO)

                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))

                const latestTimestamp = await getTimestamp()
                await expectInProposedLockModules(fulcrum, "dummy4", latestTimestamp)

                const tx = fulcrum.connect(sa.governor.signer).cancelLockModule(keccak256(toUtf8Bytes("dummy4")))

                // validate event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleLockCancelled")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy4"))))

                await expectInProposedLockModules(fulcrum, "dummy4", ZERO)

                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)
            })
        })
    })

    describe("lockModule()", () => {
        context("should fail", () => {
            it("when not initialized", async () => {
                const initialized = await fulcrum.initialized()
                expect(initialized).to.equal(true)
            })
            it("when not called by Governor", async () => {
                await expect(fulcrum.connect(sa.other.signer).lockModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "GOV: caller is not the Governor",
                )
            })
            it("when not existing key passed", async () => {
                await expect(fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy")))).to.be.revertedWith(
                    "Delay not over",
                )
            })
            it("when delay not over", async () => {
                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await increaseTime(ONE_DAY)
                await expect(fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy4")))).to.be.revertedWith(
                    "Delay not over",
                )
            })
            it("when delay is less then 10 second of opt out period", async () => {
                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await increaseTime(ONE_WEEK.sub(BN.from(10)))
                await expect(fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy4")))).to.be.revertedWith(
                    "Delay not over",
                )
            })
        })
        context("should succeed", () => {
            it("when a valid lock Module", async () => {
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)

                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await expectInProposedLockModules(fulcrum, "dummy4", await getTimestamp())

                await increaseTime(ONE_WEEK)

                const tx = fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy4")))
                // validate event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleLockEnabled")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy4"))))

                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, true)
            })
            it("when delay is more then 10 second of opt out period", async () => {
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, false)

                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy4")))
                await expectInProposedLockModules(fulcrum, "dummy4", await getTimestamp())

                await increaseTime(ONE_WEEK.add(BN.from(10)))

                const tx = fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy4")))
                // validate event
                await expect(tx)
                    .to.emit(fulcrum, "ModuleLockEnabled")
                    .withArgs(hexlify(keccak256(toUtf8Bytes("dummy4"))))

                await expectInProposedLockModules(fulcrum, "dummy4", ZERO)
                await expectInModules(fulcrum, "dummy4", sa.dummy4.address, true)
            })
        })
    })

    describe("moduleExists()", () => {
        context("should return false", () => {
            it("when key not exist", async () => {
                const result = await fulcrum.moduleExists(keccak256(toUtf8Bytes("dummy")))
                expect(result).to.equal(false)
            })
            it("when key is zero", async () => {
                const result = await fulcrum.moduleExists(ZERO_KEY)
                expect(result).to.equal(false)
            })
        })
        context("should return true", () => {
            it("when a valid module key", async () => {
                const result = await fulcrum.moduleExists(keccak256(toUtf8Bytes("dummy3")))
                expect(result).to.equal(true)
            })
        })
    })

    describe("Extra tests", () => {
        context("should not allow", () => {
            it("proposeModule + requestLockModule for a same key", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, await getTimestamp())
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)

                await increaseTime(ONE_WEEK)

                await fulcrum.connect(sa.governor.signer).acceptProposedModule(keccak256(toUtf8Bytes("dummy1")))
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, false)

                await fulcrum.connect(sa.governor.signer).requestLockModule(keccak256(toUtf8Bytes("dummy1")))
                await expectInProposedLockModules(fulcrum, "dummy1", await getTimestamp())

                await increaseTime(ONE_WEEK)

                await fulcrum.connect(sa.governor.signer).lockModule(keccak256(toUtf8Bytes("dummy1")))
                await expectInProposedLockModules(fulcrum, "dummy1", ZERO)
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, true)
            })
        })
        context("should succeed", () => {
            it("when propose a module, cancel it and then propose the same module it again", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, await getTimestamp())
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)

                await fulcrum.connect(sa.governor.signer).cancelProposedModule(keccak256(toUtf8Bytes("dummy1")))
                await expectInProposedModules(fulcrum, "dummy1", ZERO_ADDRESS, ZERO)
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)

                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, await getTimestamp())
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)
            })
            it("can propose multiple modules and cancel one, and accept one, and leave one", async () => {
                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy1")), sa.dummy1.address)
                await expectInProposedModules(fulcrum, "dummy1", sa.dummy1.address, await getTimestamp())
                await expectInModules(fulcrum, "dummy1", ZERO_ADDRESS, false)

                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("dummy2")), sa.dummy2.address)
                await expectInProposedModules(fulcrum, "dummy2", sa.dummy2.address, await getTimestamp())
                await expectInModules(fulcrum, "dummy2", ZERO_ADDRESS, false)

                await fulcrum.connect(sa.governor.signer).proposeModule(keccak256(toUtf8Bytes("other")), sa.other.address)
                const timestampOther = await getTimestamp()
                await expectInProposedModules(fulcrum, "other", sa.other.address, timestampOther)
                await expectInModules(fulcrum, "other", ZERO_ADDRESS, false)

                await increaseTime(ONE_WEEK)

                // accept
                await fulcrum.connect(sa.governor.signer).acceptProposedModule(keccak256(toUtf8Bytes("dummy1")))
                await expectInProposedModules(fulcrum, "dummy1", ZERO_ADDRESS, ZERO)
                await expectInModules(fulcrum, "dummy1", sa.dummy1.address, false)

                // cancel
                await fulcrum.connect(sa.governor.signer).cancelProposedModule(keccak256(toUtf8Bytes("dummy2")))
                await expectInProposedModules(fulcrum, "dummy2", ZERO_ADDRESS, ZERO)
                await expectInModules(fulcrum, "dummy2", ZERO_ADDRESS, false)

                // "other" is un-affected
                await expectInProposedModules(fulcrum, "other", sa.other.address, timestampOther)
                await expectInModules(fulcrum, "other", ZERO_ADDRESS, false)
            })
        })
    })
})
