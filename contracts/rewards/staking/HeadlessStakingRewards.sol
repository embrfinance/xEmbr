// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.6;

// Internal
import { InitializableRewardsDistributionRecipient } from "../InitializableRewardsDistributionRecipient.sol";
import { StableMath } from "../../shared/StableMath.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

// Libs
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title  HeadlessStakingRewards
 * @author mStable
 * @notice Rewards stakers of a given LP token with REWARDS_TOKEN, on a pro-rata basis
 * @dev Forked from `StakingRewards.sol`
 *      Changes:
 *          - `pendingAdditionalReward` added to support accumulation of any extra staking token
 *          - Removal of `StakingTokenWrapper`, instead, deposits and withdrawals are made in child contract,
 *            and balances are read from there through the abstract functions
 */
abstract contract HeadlessStakingRewards is
    ContextUpgradeable,
    InitializableRewardsDistributionRecipient
{
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice tokens the rewards are distributed in.
    IERC20[] public rewardTokens;
    IERC20 public immutable embr;

    // Constants
    uint256 private constant maxActiveRewardTokens = 10;
    uint256 private constant WEEK = 7 days;
    uint256 private constant redemptionIndex = 2**256 - 1;

    /// @notice List of tokens supported by the protocol
    EnumerableSet.AddressSet private rewardTokenAddresses;
    uint256 public override activeTokenCount = 0; 

    /// @notice length of each staking period in seconds. 7 days = 604,800; 3 months = 7,862,400
    uint256 public constant DURATION = 1 weeks;

    struct Data {
        /// Timestamp for current period finish
        uint32 periodFinish;
        /// Last time any user took action
        uint32 lastUpdateTime;
        /// RewardRate for the rest of the period
        uint256 rewardRate;
        /// Ever increasing rewardPerToken rate, based on % of total supply
        uint256 rewardPerTokenStored;
    }

    struct UserData {
        uint256 rewardPerTokenPaid;
        uint256 rewards;
        uint256 rewardsPaid;
    }

    struct RewardInfo { 
        uint256 current;
        uint256 last;
        uint256 expiry;
    }

    /// @notice list of active and expire index's for reward tokens.
    mapping(uint256 => RewardInfo) public activeRewardInfo;
    mapping(uint256 => Data) public globalData;
    mapping(uint256 => mapping(address => UserData)) public userData;
    mapping(uint256 => uint256) public override pendingAdditionalReward;

    event RewardAdded(uint256 reward, address indexed rewardToken);
    event RewardPaid(address indexed user, address indexed to, address indexed rewardToken, uint256 reward);
    event LogTokenAddition(uint256 indexed rtid, address indexed rewardToken);
    event LogTokenUpdate(address indexed lastAddress, uint256 expiry, address indexed newAddress, uint256 newIndex);


    /**
     * @param _fulcrum mStable system Fulcrum address
     */
    constructor(address _fulcrum, address _embrAddress)
        InitializableRewardsDistributionRecipient(_fulcrum)
    {
        embr = IERC20(_embrAddress);
    }

    /**
     * @dev Initialization function for upgradable proxy contract.
     *      This function should be called via Proxy just after contract deployment.
     *      To avoid variable shadowing appended `Arg` after arguments name.
     * @param _rewardsDistributorArg mStable Reward Distributor contract address
     */
    function _initialize(address _rewardsDistributorArg) internal virtual override {
        InitializableRewardsDistributionRecipient._initialize(_rewardsDistributorArg);
    }

    /**
     * @dev Adds new reward token if max reward tokens not exceeded.
     */
    function add(address _rewardTokens) 
        external 
        override
        onlyRewardsDistributor 
    {
        require(
            !rewardTokenAddresses.contains(_rewardTokens),
            "add: Reward Token already added"
        );
        require(
            activeTokenCount < 10, 
            "add: Max tokens"
        );

        IERC20 feeToken = IERC20(_rewardTokens);
        
        rewardTokens.push(feeToken);
        RewardInfo memory init = RewardInfo({
            current: rewardTokens.length - 1,
            last: 0,
            expiry: 0
        });

        activeRewardInfo[rewardTokens.length - 1] = init;
        rewardTokenAddresses.add(_rewardTokens);
        activeTokenCount++;
        
        emit LogTokenAddition(
            rewardTokens.length - 1,
            _rewardTokens
        );
    }

    /**
     * @dev Updates existing active token index to new reward token.
     *      Adds to rewardTokens index if doesn't exist, otherwise
     *      reuses expires token
     */
    function update( 
        uint256 _id, 
        address _rewardToken,
        uint256 _index
    ) 
        external 
        override 
        onlyRewardsDistributor 
    {
        RewardInfo memory rToken = activeRewardInfo[_id];
        uint256 currentTime = block.timestamp;
        
        require(currentTime >= rToken.expiry, "update: previous not expired");

        uint256 last = rToken.current;
        uint256 current = 0;
        address previousAddress = address(rewardTokens[_id]);
        if(rewardTokenAddresses.contains(_rewardToken)) { 
            require(address(rewardTokens[_index]) == _rewardToken, "update: token does not match index");
            current = _index;
        } else { 
            IERC20 feeToken = IERC20(_rewardToken);
            rewardTokens.push(feeToken);
            rewardTokenAddresses.add(_rewardToken);

            current = rewardTokens.length;

            emit LogTokenAddition(
                current,
                _rewardToken
            );
        }
        
        rToken.last = last;
        rToken.current = current;
        rToken.expiry = block.timestamp + WEEK;
        activeRewardInfo[_id] = rToken;

        emit LogTokenUpdate(previousAddress, rToken.expiry, _rewardToken, rewardTokens.length);
    }

    /** @dev Updates the reward for a given address, before executing function */
    modifier updateReward(uint256 _tid, address _account) {
        _updateReward(_tid, _account);
        _;
    }

    /** @dev Updates the rewards for a given address, before executing function */
    modifier updateRewards(address _account) {
        _updateReward(redemptionIndex, _account);
        for(uint256 i = 0; i < activeTokenCount; i++) {
            _updateReward(i, _account);
        }
        _;
    }

    function _updateReward(uint256 _tid, address _account) internal {
        // Setting of global vars
        uint256 currentIndex = _tid == redemptionIndex ? redemptionIndex : activeRewardInfo[_tid].current;
        (uint256 newRewardPerToken, uint256 lastApplicableTime) = _rewardPerToken(currentIndex);
        // If statement protects against loss in initialisation case
        if (newRewardPerToken > 0) {
            globalData[currentIndex].rewardPerTokenStored = newRewardPerToken;
            globalData[currentIndex].lastUpdateTime = SafeCast.toUint32(lastApplicableTime);

            // Setting of personal vars based on new globals
            if (_account != address(0)) {
                userData[currentIndex][_account] = UserData({
                    rewardPerTokenPaid: newRewardPerToken,
                    rewards: _earned(currentIndex, _account, newRewardPerToken),
                    rewardsPaid: userData[currentIndex][_account].rewardsPaid
                });

            }
        }
    }

    /***************************************
                    ACTIONS
    ****************************************/

    /**
     * @dev Claims outstanding rewards for the sender.
     * First updates outstanding reward allocation and then transfers.
     */
    function claimReward(uint256 _tid, address _to) public {
        _claimReward(_tid, _to);
    }

    /**
     * @dev Claims outstanding rewards for the sender.
     * First updates outstanding reward allocation and then transfers.
     */
     function claimReward(uint256 _tid) public {
        _claimReward(_tid, _msgSender());
    }

    /**
     * @dev Claims outstanding rewards for the sender.
     * First updates outstanding reward allocation and then transfers.
     */
    function claimRedemptionReward() public {
        _claimRedemptionRewards(_msgSender());
    }

    /**
     * @dev Claims outstanding rewards for the sender.
     * First updates outstanding reward allocation and then transfers.
     */
    function claimExpiredReward(uint256 _tid) public {
        _claimExpiredReward(_tid, _msgSender());
    }

    /**
     * @dev Claims outstanding rewards for the sender for all reward tokens.
     * First updates outstanding reward allocation and then transfers.
     */
    function claimRewards() 
        public  
        updateRewards(_msgSender()) 
    {
        _claimRewards(_msgSender());
    }

    function _claimRewards(address sender) 
        private 
    {
        _claimRedemptionRewards(sender);
        for (uint256 i = 0; i < activeTokenCount; i++) {
           _claimReward(i, sender);
        }
    }

    function _claimExpiredReward(
        uint256 _tid, 
        address sender
    ) 
        private 
    {
        require(activeRewardInfo[_tid].expiry > block.timestamp, "claimExpiredReward: time expired");

        uint256 currentIndex = activeRewardInfo[_tid].last;
        (uint256 newRewardPerToken, uint256 lastApplicableTime) = _rewardPerToken(currentIndex);
        // If statement protects against loss in initialisation case
        if (newRewardPerToken > 0) {
            globalData[currentIndex].rewardPerTokenStored = newRewardPerToken;
            globalData[currentIndex].lastUpdateTime = SafeCast.toUint32(lastApplicableTime);

            // Setting of personal vars based on new globals
            if (sender != address(0)) {
                userData[currentIndex][sender] = UserData({
                    rewardPerTokenPaid: newRewardPerToken,
                    rewards: _earned(currentIndex, sender, newRewardPerToken),
                    rewardsPaid: userData[currentIndex][sender].rewardsPaid
                });

            }
        }

        uint256 reward = userData[currentIndex][sender].rewards;
        if (reward > 0) {
            userData[currentIndex][sender].rewards = 0;
            embr.safeTransfer(sender, reward);
            userData[currentIndex][sender].rewardsPaid =  userData[currentIndex][sender].rewardsPaid + reward;

            emit RewardPaid(sender, sender, address(rewardTokens[currentIndex]), reward);
        }     
    }


    function _claimRedemptionRewards(address _to) internal updateReward(redemptionIndex, _msgSender()) { 
        uint256 redemptionReward = userData[redemptionIndex][_msgSender()].rewards;
        if (redemptionReward > 0) {
            userData[redemptionIndex][_msgSender()].rewards = 0;
            embr.safeTransfer(_to, redemptionReward);
            userData[redemptionIndex][_msgSender()].rewardsPaid =  userData[redemptionIndex][_msgSender()].rewardsPaid + redemptionReward;

            emit RewardPaid(_to, _to, address(embr), redemptionReward);
        }
    }

    function _claimReward(uint256 _tid, address _to) internal updateReward(_tid, _msgSender()) {
        uint256 reward = userData[_tid][_msgSender()].rewards;
        uint256 currentIndex = _tid == redemptionIndex ? redemptionIndex : activeRewardInfo[_tid].current;
        if (reward > 0) {
            userData[currentIndex][_msgSender()].rewards = 0;
            rewardTokens[currentIndex].safeTransfer(_to, reward);
            userData[currentIndex][_msgSender()].rewardsPaid =  userData[currentIndex][_msgSender()].rewardsPaid + reward;

            emit RewardPaid(_to, _to,address(rewardTokens[currentIndex]), reward);
        }
        _claimRewardHook(_msgSender());
    }

    /***************************************
                    GETTERS
    ****************************************/

    /**
     * @dev Gets the RewardsToken
     */
    function getActiveIndex(uint256 _tid) external view override returns (uint256) {
        return activeRewardInfo[_tid].current;
    }

    /**
     * @dev Gets the RewardsToken
     */
    function getRewardToken(uint256 _tid) external view override returns (IERC20) {
        return rewardTokens[_tid];
    }

    //function getRewardToken() external view override returns (IERC20) {
    //    return REWARDS_TOKEN;
    //}

    /**
     * @dev Gets the last applicable timestamp for this reward period
     */
    function lastTimeRewardApplicable(uint256 _tid) public view returns (uint256) {
        uint256 currentIndex = _tid == redemptionIndex ? redemptionIndex : activeRewardInfo[_tid].current;
        return StableMath.min(block.timestamp, globalData[currentIndex].periodFinish);
    }

    /**
     * @dev Gets the last applicable timestamp for this reward period
     */
    function _lastTimeRewardApplicable(uint32 _periodFinish) internal view returns (uint256) {
        return StableMath.min(block.timestamp, _periodFinish);
    }

    /**
     * @dev Calculates the amount of unclaimed rewards per token since last update,
     * and sums with stored to give the new cumulative reward per token
     * @return 'Reward' per staked token
     */
    function rewardPerToken(uint256 _tid) public view returns (uint256) {
        uint256 currentIndex = _tid == redemptionIndex ? redemptionIndex : activeRewardInfo[_tid].current;
        (uint256 rewardPerToken_, ) = _rewardPerToken(currentIndex);
        return rewardPerToken_;
    }

    function _rewardPerToken(uint256 _tid)
        internal
        view
        returns (uint256 rewardPerToken_, uint256 lastTimeRewardApplicable_)
    {
        Data memory data = globalData[_tid];
        uint256 lastApplicableTime = _lastTimeRewardApplicable(data.periodFinish); // + 1 SLOAD

        uint256 timeDelta = lastApplicableTime - data.lastUpdateTime; // + 1 SLOAD
        // If this has been called twice in the same block, shortcircuit to reduce gas
        if (timeDelta == 0) {
            return (data.rewardPerTokenStored, lastApplicableTime);
        }
        // new reward units to distribute = rewardRate * timeSinceLastUpdate
        uint256 rewardUnitsToDistribute = data.rewardRate * timeDelta; // + 1 SLOAD
        uint256 supply = totalSupply(); // + 1 SLOAD
        // If there is no StakingToken liquidity, avoid div(0)
        // If there is nothing to distribute, short circuit
        if (supply == 0 || rewardUnitsToDistribute == 0) {
            return (data.rewardPerTokenStored, lastApplicableTime);
        }
        // new reward units per token = (rewardUnitsToDistribute * 1e18) / totalTokens
        uint256 unitsToDistributePerToken = rewardUnitsToDistribute.divPrecisely(supply);
        // return summed rate
        return (data.rewardPerTokenStored + unitsToDistributePerToken, lastApplicableTime); // + 1 SLOAD
    }

    /**
     * @dev Calculates the amount of unclaimed rewards a user has earned
     * @param _account User address
     * @return Total reward amount earned
     */
    function earned(uint256 _tid, address _account) public view returns (uint256) {
        uint256 currentIndex = _tid == redemptionIndex ? redemptionIndex : activeRewardInfo[_tid].current;
        return _earned(currentIndex, _account, rewardPerToken(currentIndex));
    }

    function _earned(uint256 _currentIndex, address _account, uint256 _currentRewardPerToken)
        internal
        view
        returns (uint256)
    {
        // current rate per token - rate user previously received
        uint256 userRewardDelta = _currentRewardPerToken - userData[_currentIndex][_account].rewardPerTokenPaid; // + 1 SLOAD
        // Short circuit if there is nothing new to distribute
        if (userRewardDelta == 0) {
            return userData[_currentIndex][_account].rewards;
        }
        // new reward = staked tokens * difference in rate
        uint256 userNewReward = balanceOf(_account).mulTruncate(userRewardDelta); // + 1 SLOAD
        // add to previous rewards
        return userData[_currentIndex][_account].rewards + userNewReward;
    }

    /***************************************
                    ABSTRACT
    ****************************************/

    function balanceOf(address account) public view virtual returns (uint256);

    function totalSupply() public view virtual returns (uint256);

    function _claimRewardHook(address account) internal virtual;

    /***************************************
                    ADMIN
    ****************************************/

    /**
     * @dev Notifies the contract that new rewards have been added.
     * Calculates an updated rewardRate based on the rewards in period.
     * @param _reward Units of RewardToken that have been added to the pool
     */
    function notifyRewardAmount(uint256 _tid, uint256 _reward)
        external
        override
        onlyRewardsDistributor
        updateReward(_tid, address(0))
    {
        uint256 currentTime = block.timestamp;
        if(_tid != redemptionIndex) {
            require(_tid + 1 <= rewardTokens.length, "Outside of index");
        }

        // Pay and reset the pendingAdditionalRewards
        if (pendingAdditionalReward[_tid] > 1) {
            _reward += (pendingAdditionalReward[_tid] - 1);
            pendingAdditionalReward[_tid] = 1;
        }

        // If previous period over, reset rewardRate
        if (currentTime >= globalData[_tid].periodFinish) {
            globalData[_tid].rewardRate = _reward / DURATION;
        }
        // If additional reward to existing period, calc sum
        else {
            uint256 remainingSeconds = globalData[_tid].periodFinish - currentTime;
            uint256 leftover = remainingSeconds * globalData[_tid].rewardRate;
            globalData[_tid].rewardRate = (_reward + leftover) / DURATION;
        }

        globalData[_tid].lastUpdateTime = SafeCast.toUint32(currentTime);
        globalData[_tid].periodFinish = SafeCast.toUint32(currentTime + DURATION);

        address rewardTknAddress = _tid == redemptionIndex ? address(embr) : address(rewardTokens[_tid]);
        emit RewardAdded(_reward, rewardTknAddress);
    }

    /**
     * @dev Called by the child contract to notify of any additional rewards that have accrued.
     *      Trusts that this is called honestly.
     * @param _tid token index of additional rewards
     * @param _additionalReward Units of additional RewardToken to add at the next notification
     */
    function _notifyAdditionalReward(uint256 _tid, uint256 _additionalReward) internal virtual {
        require(_additionalReward < 1e24, "Cannot notify with more than a million units");

        pendingAdditionalReward[_tid] += _additionalReward;
    }
}
