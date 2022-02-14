// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IRewardsDistributionRecipient } from "../../interfaces/IRewardsDistributionRecipient.sol";

contract MockRewardsDistributionRecipient is
    IRewardsDistributionRecipient
{
    IERC20[] public rewardTokens;

    constructor(IERC20 _rewardToken) {
        rewardTokens.push(_rewardToken);
    }

    function notifyRewardAmount(uint256 _tid, uint256 reward)
        external
        override(IRewardsDistributionRecipient)
    {
        // do nothing
    }
    

    function getRewardToken(uint256 _tid)
        external
        view
        override(IRewardsDistributionRecipient)
        returns (IERC20)
    {
        return rewardTokens[_tid];
    }

     function activeTokenCount() 
        external 
        view 
        override(IRewardsDistributionRecipient)
        returns (uint256) 
    {
        return 1;
    }

    function getActiveIndex(uint256 _tid)
        external
        view
        override(IRewardsDistributionRecipient)
        returns (uint256)
    {
        return _tid;
    }

    function add(address _rewardTokens) external virtual override 
    {

    }

    function update( uint256 _id, address _rewardToken, uint256 _index) external virtual override 
    {

    }

}
