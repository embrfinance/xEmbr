import { StandardAccounts } from "@utils/machines"
import { expect } from "chai"
import { ZERO_ADDRESS } from "@utils/constants"
import { IFulcrum__factory, PausableModule } from "types/generated"

export interface IPausableModuleBehaviourContext {
    module: PausableModule
    sa: StandardAccounts
}

export function shouldBehaveLikePausableModule(ctx: IPausableModuleBehaviourContext): void {
    it("should have Fulcrum", async () => {
        const fulcrumAddr = await ctx.module.fulcrum()
        expect(fulcrumAddr).to.not.equal(ZERO_ADDRESS)
    })

    it("should have Governor address", async () => {
        const fulcrumAddr = await ctx.module.fulcrum()
        const fulcrum = await IFulcrum__factory.connect(fulcrumAddr, ctx.sa.default.signer)

        const fulcrumGovernor = await fulcrum.governor()
        expect(fulcrumGovernor).to.equal(ctx.sa.governor.address)
    })

    it("should not be paused", async () => {
        const paused = await ctx.module.paused()
        expect(paused).to.eq(false)
    })
    it("should allow pausing and unpausing by governor", async () => {
        // Pause
        let tx = ctx.module.connect(ctx.sa.governor.signer).pause()
        await expect(tx).to.emit(ctx.module, "Paused").withArgs(ctx.sa.governor.address)
        // Fail if already paused
        await expect(ctx.module.connect(ctx.sa.governor.signer).pause()).to.be.revertedWith("Pausable: paused")

        // Unpause
        tx = ctx.module.connect(ctx.sa.governor.signer).unpause()
        await expect(tx).to.emit(ctx.module, "Unpaused").withArgs(ctx.sa.governor.address)

        // Fail to unpause twice
        await expect(ctx.module.connect(ctx.sa.governor.signer).unpause()).to.be.revertedWith("Pausable: not paused")
    })
    it("should fail to pause if non-governor", async () => {
        await expect(ctx.module.connect(ctx.sa.other.signer).pause()).to.be.revertedWith("Only governor can execute")
    })
}

export default shouldBehaveLikePausableModule
