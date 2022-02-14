import { Signer } from "ethers"
import {
    AssetProxy__factory,
    MockFulcrum__factory,
    MockERC20,
    DelayedProxyAdmin,
    MockInitializableToken,
    IPlatformIntegration,
    MockInitializableToken__factory,
    MockInitializableTokenWithFee__factory,
    AssetProxy,
    MockFulcrum,
    MockERC20__factory,
} from "types/generated"
import { BN, minimum, simpleToExactAmount } from "@utils/math"
import { fullScale, ratioScale, ZERO_ADDRESS, DEAD_ADDRESS } from "@utils/constants"
import { EthAddress } from "types/common"
import { StandardAccounts } from "./standardAccounts"

export interface xEmbrDetails {
    proxyAdmin?: DelayedProxyAdmin
    integrationAddress?: string
    fulcrum?: MockFulcrum
}

export class xEmbrMachine {
    public sa: StandardAccounts

    public async initAccounts(accounts: Signer[]): Promise<xEmbrMachine> {
        this.sa = await new StandardAccounts().initAccounts(accounts)
        return this
    }

    // 3 bAssets, custom reserve
    public async deployLite(a = 135): Promise<xEmbrDetails> {
        const fulcrum = await new MockFulcrum__factory(this.sa.default.signer).deploy(
            this.sa.governor.address
        )

        return {
            fulcrum,
        }
    }

    public async deployxEmbr(useLendingMarkets = false, useTransferFees = false, a = 100): Promise<xEmbrDetails> {
        const fulcrum = await new MockFulcrum__factory(this.sa.default.signer).deploy(
            this.sa.governor.address
        )

        return {
            integrationAddress: ZERO_ADDRESS,
            fulcrum
        }
    }

    // /**
    //  * @dev Deploys an mAsset with default parameters, modelled on original mUSD
    //  * @return Interface will all deployed information
    //  */
    // public async deployxEmbr(enableUSDTFee = false, useOldAave = false): Promise<xEmbrDetails> {
    //     const md: xEmbrDetails = {};

    //     /** *************************************
    //     0. Mock platforms and bAssets
    //     Dependencies: []
    //     *************************************** */
    //     const bassetDetails = await this.loadBassets(enableUSDTFee, useOldAave);
    //     md.bAssets = bassetDetails.bAssets;

    //     /** *************************************
    //     2. mUSD
    //         Dependencies: [
    //             BasketManager [
    //                 ProxyAdmin,
    //                 PlatformIntegrations [
    //                     MockPlatforms
    //                 ]
    //             ]
    //         ]
    //     *************************************** */

    //     // 2.0. Deploy ProxyAdmin
    //     const d_DelayedProxyAdmin: t.DelayedProxyAdminInstance = await c_DelayedProxyAdmin.new(
    //         this.system.fulcrum.address,
    //         {
    //             from: this.sa.default,
    //         },
    //     );
    //     md.proxyAdmin = d_DelayedProxyAdmin;

    //     // 2.1. Deploy no Init BasketManager
    //     //  - Deploy Implementation
    //     const d_BasketManager = await c_BasketManager.new();
    //     //  - Initialize the BasketManager implementation to avoid someone else doing it
    //     const d_DeadIntegration = await c_DeadIntegration.new();
    //     const d_DeadErc20 = await c_MockERC20.new("DEAD", "D34", 18, DEAD_ADDRESS, 1);
    //     await d_BasketManager.initialize(
    //         DEAD_ADDRESS,
    //         DEAD_ADDRESS,
    //         [d_DeadErc20.address],
    //         [d_DeadIntegration.address],
    //         [percentToWeight(100).toString()],
    //         [false],
    //     );
    //     //  - Deploy Initializable Proxy
    //     const d_BasketManagerProxy = await c_BasketManagerProxy.new();

    //     // 2.2. Deploy no Init AaveIntegration
    //     //  - Deploy Implementation with dummy params (this storage doesn't get used)
    //     const d_AaveIntegration = await (useOldAave
    //         ? c_AaveIntegration.new()
    //         : c_AaveV2Integration.new());
    //     await d_AaveIntegration.initialize(DEAD_ADDRESS, [DEAD_ADDRESS], DEAD_ADDRESS, [], []);
    //     //  - Deploy Initializable Proxy
    //     const d_AaveIntegrationProxy = await c_VaultProxy.new();

    //     // 2.3. Deploy no Init CompoundIntegration
    //     //  - Deploy Implementation
    //     // We do not need platform address for compound
    //     const d_CompoundIntegration: t.CompoundIntegrationInstance = await c_CompoundIntegration.new();
    //     await d_CompoundIntegration.initialize(DEAD_ADDRESS, [DEAD_ADDRESS], DEAD_ADDRESS, [], []);
    //     //  - Deploy Initializable Proxy
    //     const d_CompoundIntegrationProxy = await c_VaultProxy.new();

    //     md.basketManager = await c_BasketManager.at(d_BasketManagerProxy.address);
    //     md.aaveIntegration = await c_AaveIntegration.at(d_AaveIntegrationProxy.address);
    //     md.compoundIntegration = await c_CompoundIntegration.at(d_CompoundIntegrationProxy.address);

    //     // 2.4. Deploy mUSD (w/ BasketManager addr)
    //     // 2.4.1. Deploy ForgeValidator
    //     const d_ForgeValidator = await c_ForgeValidator.new({
    //         from: this.sa.default,
    //     });
    //     md.forgeValidator = d_ForgeValidator;
    //     // 2.4.2. Deploy mUSD
    //     // Deploy implementation
    //     const d_mUSD = await c_xEmbr.new();
    //     await d_mUSD.initialize("", "", DEAD_ADDRESS, DEAD_ADDRESS, DEAD_ADDRESS);
    //     // Deploy proxy
    //     const d_mUSDProxy = await c_AssetProxy.new();
    //     // Initialize proxy
    //     const initializationData_mUSD: string = d_mUSD.contract.methods
    //         .initialize(
    //             "mStable Mock",
    //             "mMOCK",
    //             this.system.fulcrum.address,
    //             d_ForgeValidator.address,
    //             d_BasketManagerProxy.address,
    //         )
    //         .encodeABI();
    //     await d_mUSDProxy.methods["initialize(address,address,bytes)"](
    //         d_mUSD.address,
    //         d_DelayedProxyAdmin.address,
    //         initializationData_mUSD,
    //     );
    //     md.mAsset = await c_xEmbr.at(d_mUSDProxy.address);

    //     // 2.5. Init AaveIntegration
    //     const initializationData_AaveIntegration: string = d_AaveIntegration.contract.methods
    //         .initialize(
    //             this.system.fulcrum.address,
    //             [d_mUSDProxy.address, d_BasketManagerProxy.address],
    //             bassetDetails.aavePlatformAddress,
    //             bassetDetails.aTokens.map((a) => a.bAsset),
    //             bassetDetails.aTokens.map((a) => a.aToken),
    //         )
    //         .encodeABI();
    //     await d_AaveIntegrationProxy.methods["initialize(address,address,bytes)"](
    //         d_AaveIntegration.address,
    //         d_DelayedProxyAdmin.address,
    //         initializationData_AaveIntegration,
    //     );

    //     // 2.6. Init CompoundIntegration
    //     const initializationData_CompoundIntegration: string = d_CompoundIntegration.contract.methods
    //         .initialize(
    //             this.system.fulcrum.address,
    //             [d_mUSDProxy.address, d_BasketManagerProxy.address],
    //             ZERO_ADDRESS, // We don't need Compound sys addr
    //             bassetDetails.cTokens.map((c) => c.bAsset),
    //             bassetDetails.cTokens.map((c) => c.cToken),
    //         )
    //         .encodeABI();
    //     await d_CompoundIntegrationProxy.methods["initialize(address,address,bytes)"](
    //         d_CompoundIntegration.address,
    //         d_DelayedProxyAdmin.address,
    //         initializationData_CompoundIntegration,
    //     );

    //     // 2.7. Init BasketManager
    //     const weight = 100;
    //     const initializationData_BasketManager: string = d_BasketManager.contract.methods
    //         .initialize(
    //             this.system.fulcrum.address,
    //             d_mUSDProxy.address,
    //             bassetDetails.bAssets.map((b) => b.address),
    //             bassetDetails.platforms.map((p) =>
    //                 p === Platform.aave
    //                     ? d_AaveIntegrationProxy.address
    //                     : d_CompoundIntegrationProxy.address,
    //             ),
    //             bassetDetails.bAssets.map(() => percentToWeight(weight).toString()),
    //             bassetDetails.fees,
    //         )
    //         .encodeABI();
    //     await d_BasketManagerProxy.methods["initialize(address,address,bytes)"](
    //         d_BasketManager.address,
    //         d_DelayedProxyAdmin.address,
    //         initializationData_BasketManager,
    //     );

    //     return md;
    // }

    // public async loadBassets(
    //     enableUSDTFee = false,
    //     useOldAave = false,
    // ): Promise<BassetIntegrationDetails> {
    //     return this.system.isGanacheFork
    //         ? this.loadBassetsFork(enableUSDTFee)
    //         : this.loadBassetsLocal(enableUSDTFee, useOldAave);
    // }

    // public async loadBassetsFork(enableUSDTFee = false): Promise<BassetIntegrationDetails> {
    //     // load all the REAL bAssets
    //     const bAsset_DAI = await c_MockERC20.at(this.ma.DAI);
    //     await this.mintERC20(bAsset_DAI, this.ma.FUND_SOURCES.dai);

    //     const bAsset_USDC = await c_MockERC20.at(this.ma.USDC);
    //     await this.mintERC20(bAsset_USDC, this.ma.FUND_SOURCES.usdc);

    //     const bAsset_TUSD = await c_MockERC20.at(this.ma.TUSD);
    //     await this.mintERC20(bAsset_TUSD, this.ma.FUND_SOURCES.tusd);

    //     const bAsset_USDT = await c_MockERC20.at(this.ma.USDT);
    //     await this.mintERC20(bAsset_USDT, this.ma.FUND_SOURCES.usdt);

    //     const mockUSDT = await c_MockUSDT.at(bAsset_USDT.address);
    //     if (enableUSDTFee) {
    //         // Set fee rate to 0.1% and max fee to 30 USDT
    //         await mockUSDT.setParams("10", "30", {
    //             from: this.ma.USDT_OWNER,
    //         });
    //     } else {
    //         // Set fee rate to 0.1% and max fee to 30 USDT
    //         await mockUSDT.setParams("0", "30", {
    //             from: this.ma.USDT_OWNER,
    //         });
    //     }
    //     // credit sa.default with ample balances
    //     const bAssets = [bAsset_DAI, bAsset_USDC, bAsset_TUSD, bAsset_USDT];
    //     // return all the addresses
    //     return {
    //         bAssets,
    //         fees: [false, false, false, enableUSDTFee],
    //         platforms: [Platform.compound, Platform.compound, Platform.aave, Platform.aave],
    //         aavePlatformAddress: this.ma.aavePlatform,
    //         aTokens: [
    //             {
    //                 bAsset: bAsset_TUSD.address,
    //                 aToken: this.ma.aTUSD,
    //             },
    //             {
    //                 bAsset: bAsset_USDT.address,
    //                 aToken: this.ma.aUSDT,
    //             },
    //         ],
    //         cTokens: [
    //             {
    //                 bAsset: bAsset_DAI.address,
    //                 cToken: this.ma.cDAI,
    //             },
    //             {
    //                 bAsset: bAsset_USDC.address,
    //                 cToken: this.ma.cUSDC,
    //             },
    //         ],
    //     };
    // }

    public async loadBassetProxy(
        name: string,
        sym: string,
        dec: number,
        recipient: string = this.sa.default.address,
        init = 10000000000,
        enableUSDTFee = false,
    ): Promise<MockERC20> {
        // Factories
        const tokenFactory = enableUSDTFee
            ? await new MockInitializableTokenWithFee__factory(this.sa.default.signer)
            : await new MockInitializableToken__factory(this.sa.default.signer)
        const AssetProxyFactory = new AssetProxy__factory(this.sa.default.signer)

        // Impl
        const mockInitializableToken = (await tokenFactory.deploy()) as MockInitializableToken

        // Proxy
        const data = await mockInitializableToken.interface.encodeFunctionData("initialize", [name, sym, dec, recipient, init])
        const mAssetProxy = await AssetProxyFactory.deploy(mockInitializableToken.address, this.sa.governor.address, data)
        const mAsset = MockERC20__factory.connect(mAssetProxy.address, this.sa.default.signer)
        return mAsset
    }

    // public async mintERC20(
    //     erc20: t.MockERC20Instance,
    //     source: Address,
    //     recipient: string = this.sa.default,
    // ): Promise<Truffle.TransactionResponse<any>> {
    //     const decimals = await erc20.decimals();
    //     return erc20.transfer(recipient, simpleToExactAmount(1000, decimals), {
    //         from: source,
    //     });
    // }

    // /**
    //  * @dev Deploy a xEmbr via the Manager then:
    //  *      1. Mint with optimal weightings
    //  */
    // public async deployxEmbrAndSeedBasket(
    //     enableUSDTFee = false,
    //     initialSupply = 100,
    // ): Promise<xEmbrDetails> {
    //     const mAssetDetails = await this.deployxEmbr(enableUSDTFee);

    //     // Mint initialSupply with shared weightings
    //     const basketDetails = await this.getBassetsInxEmbr(mAssetDetails);

    //     // Calc optimal weightings
    //     const totalWeighting = basketDetails.reduce((p, c) => {
    //         return p.add(new BN(c.maxWeight));
    //     }, new BN(0));
    //     const totalMintAmount = simpleToExactAmount(initialSupply, 18);
    //     const mintAmounts = await Promise.all(
    //         basketDetails.map(async (b) => {
    //             // e.g. 5e35 / 2e18 = 2.5e17
    //             const relativeWeighting = new BN(b.maxWeight).mul(fullScale).div(totalWeighting);
    //             // e.g. 1e20 * 25e16 / 1e18 = 25e18
    //             const mintAmount = totalMintAmount.mul(relativeWeighting).div(fullScale);
    //             // const bAssetDecimals: BN = await b.decimals();
    //             // const decimalDelta = new BN(18).sub(bAssetDecimals);
    //             return mintAmount.mul(ratioScale).div(new BN(b.ratio));
    //         }),
    //     );

    //     // Approve bAssets
    //     await Promise.all(
    //         mAssetDetails.bAssets.map((b, i) =>
    //             b.approve(mAssetDetails.mAsset.address, mintAmounts[i].muln(2), {
    //                 from: this.system.sa.default,
    //             }),
    //         ),
    //     );

    //     await mAssetDetails.mAsset.mintMulti(
    //         basketDetails.map((b) => b.addr),
    //         mintAmounts,
    //         this.system.sa.default,
    //         { from: this.system.sa.default },
    //     );
    //     await mAssetDetails.mAsset.mintMulti(
    //         basketDetails.map((b) => b.addr),
    //         mintAmounts,
    //         this.system.sa.default,
    //         { from: this.system.sa.default },
    //     );

    //     return mAssetDetails;
    // }

}