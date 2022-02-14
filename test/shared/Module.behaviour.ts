import { StandardAccounts } from "@utils/machines"
import { expect } from "chai"
import { ZERO_ADDRESS } from "@utils/constants"
import { IFulcrum__factory, ImmutableModule } from "types/generated"

export interface IModuleBehaviourContext {
    module: ImmutableModule
    sa: StandardAccounts
}

export function shouldBehaveLikeModule(ctx: IModuleBehaviourContext): void {
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
}

export default shouldBehaveLikeModule
