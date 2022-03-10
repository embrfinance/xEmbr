// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.6;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRewardsDistributionRecipient {
    function notifyRewardAmount(uint256 _tid, uint256 reward) external;

    function getRewardToken(uint256 _tid) external view returns (IERC20);

    function getActiveIndex(uint256 _tid) external view returns (uint256);

    function activeTokenCount() external view returns (uint256);

    function pendingAdditionalReward(uint256 _tid) external view returns (uint256);

    function add(address _rewardTokens) external;

    function update( uint256 _id, address _rewardToken, uint256 _index) external;
}

interface IRewardsRecipientWithPlatformToken {
    function notifyRewardAmount(uint256 _tid, uint256 reward) external;

    function getRewardToken(uint256 _tid) external view returns (IERC20);

    function getActiveIndex(uint256 _tid) external view returns (uint256);

    function getPlatformToken() external view returns (IERC20);
}
