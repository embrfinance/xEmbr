// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.6;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRewardsDistributionRecipient {
    function notifyRewardAmount(uint256 _tid, uint256 reward) external;

    function getActiveIndex() external view returns (uint256);

    function getRewardToken() external view returns (IERC20);
}

interface IRewardsRecipientWithPlatformToken {
    function notifyRewardAmount(uint256 _tid, uint256 reward) external;

    function getRewardToken() external view returns (IERC20);

    function getActiveIndex() external view returns (uint256);

    function getPlatformToken() external view returns (IERC20);
}
