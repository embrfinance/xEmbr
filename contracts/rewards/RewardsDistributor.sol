// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.6;

import { IRewardsDistributionRecipient } from "../interfaces/IRewardsDistributionRecipient.sol";
import { ImmutableModule } from "../shared/ImmutableModule.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IProtocolFeeCollector } from "../interfaces/IProtocolFeeCollector.sol";


/**
 * @title  RewardsDistributor
 * @author mStable
 * @notice RewardsDistributor allows Fund Managers to send rewards (usually in MTA)
 * to specified Reward Recipients.
 */
contract RewardsDistributor is ImmutableModule {
    using SafeERC20 for IERC20;

    IProtocolFeeCollector public protocolFeeCollector;

    uint256 public teamPct = 0;
    uint256 public fundPct = 0;
    uint256 public treasuaryPct = 0;

    mapping(address => uint256) public teamBalance;
    mapping(address => uint256) public treasuaryBalance;

    mapping(address => bool) public fundManagers;
    mapping(address => bool) public teamManagers;
    mapping(address => bool) public treasuaryManagers;

    event AddedFundManager(address indexed _address);
    event AddedTeamManager(address indexed _address);
    event AddedTreasuaryManager(uint256 _address);
    event UpdatePayoutPercentages(uint256 teamPct, uint256 fundPct, uint256 treasuaryPct);

    event RemovedFundManager(address indexed _address);
    event RemovedTeamManager(address indexed _address);
    event RemovedTreasuaryManager(address indexed _address);

    event DistributedReward(
        address recipient,
        address rewardToken,
        uint256 amount
    );

    /**
     * @dev Modifier to allow function calls only from a fundManager address.
     */
    modifier onlyFundManager() {
        require(fundManagers[msg.sender], "Not a fund manager");
        _;
    }

        /**
     * @dev Modifier to allow function calls only from a fundManager address.
     */
    modifier onlyTeamManager() {
        require(teamManagers[msg.sender], "Not a team manager");
        _;
    }

     /**
     * @dev Modifier to allow function calls only from a fundManager address.
     */
    modifier onlyTreasuaryManager() {
        require(treasuaryManagers[msg.sender], "Not a treasuary manager");
        _;
    }


    /** @dev Recipient is a module, governed by Embr governance */
    constructor(
        address _fulcrum, 
        address _protocolFeeCollector,
        address[] memory _fundManagers,
        address[] memory _teamManagers,
        address[] memory _treasuaryManagers, 
        uint256 _teamPct,
        uint256 _fundPct,
        uint256 _treasuaryPct
    ) ImmutableModule(_fulcrum) {
        require(_teamPct + _fundPct + _treasuaryPct == 1000, "Distrubtion percent is not 1000");

        protocolFeeCollector = IProtocolFeeCollector(_protocolFeeCollector);

        for (uint256 i = 0; i < _fundManagers.length; i++) {
            _addFundManager(_fundManagers[i]);
        }
        for (uint256 i = 0; i < _teamManagers.length; i++) {
            _addTeamManager(_teamManagers[i]);
        }
        for (uint256 i = 0; i < _treasuaryManagers.length; i++) {
            _addTreasuaryManager(_treasuaryManagers[i]);
        }

        teamPct = _teamPct;
        fundPct = _fundPct;
        treasuaryPct = _treasuaryPct;
    }

    /**
     * @dev Allows the Embr governance to add a new FundManager
     * @param _address  FundManager to add
     */
    function addFundManager(address _address) external onlyGovernor {
        _addFundManager(_address);
    }

    /**
     * @dev Allows the Embr governance to add a new FundManager
     * @param _address  FundManager to add
     */
    function addTeamManager(address _address) external onlyGovernor {
        _addTeamManager(_address);
    }

    /**
     * @dev Allows the Embr governance to add a new FundManager
     * @param _address  FundManager to add
     */
    function addTreasuaryManager(address _address) external onlyGovernor {
        _addTreasuaryManager(_address);
    }

    /**
     * @dev Adds a new whitelist address
     * @param _address Address to add in whitelist
     */
    function _addFundManager(address _address) internal {
        require(_address != address(0), "Address is zero");
        require(!fundManagers[_address], "Already fund manager");

        fundManagers[_address] = true;

        emit AddedFundManager(_address);
    }

    /**
     * @dev Adds a new whitelist address
     * @param _address Address to add in whitelist
     */
    function _addTeamManager(address _address) internal {
        require(_address != address(0), "Address is zero");
        require(!teamManagers[_address], "Already team manager");

        teamManagers[_address] = true;

        emit AddedTeamManager(_address);
    }

    /**
     * @dev Adds a new whitelist address
     * @param _address Address to add in whitelist
     */
    function _addTreasuaryManager(address _address) internal {
        require(_address != address(0), "Address is zero");
        require(!treasuaryManagers[_address], "Already treasuary manager");

        treasuaryManagers[_address] = true;

        emit AddedTreasuaryManager(_address);
    }

    /**
     * @dev Allows the Embr governance to remove inactive FundManagers
     * @param _address  FundManager to remove
     */
    function removeFundManager(address _address) external onlyGovernor {
        require(_address != address(0), "Address is zero");
        require(fundManagers[_address], "Not a fund manager");

        fundManagers[_address] = false;

        emit RemovedFundManager(_address);
    }

     /**
     * @dev Allows the Embr governance to remove inactive FundManagers
     * @param _address  TeamManager to remove
     */
    function removeTeamManager(address _address) external onlyGovernor {
        require(_address != address(0), "Address is zero");
        require(teamManagers[_address], "Not a team manager");

        teamManagers[_address] = false;

        emit RemovedTeamManager(_address);
    }

     /**
     * @dev Allows the Embr governance to remove inactive FundManagers
     * @param _address  FundManager to remove
     */
    function removeTreasuaryManager(address _address) external onlyGovernor {
        require(_address != address(0), "Address is zero");
        require(treasuaryManagers[_address], "Not a treasuary manager");

        treasuaryManagers[_address] = false;

        emit RemovedTreasuaryManager(_address);
    }

    /**
     * @dev Distributes reward tokens to list of recipients and notifies them
     * of the transfer. Only callable by FundManagers
     * @param _recipient        Reward recipient to credit
     */
    function distributeProtocolRewards(
        IRewardsDistributionRecipient _recipient
    ) external onlyFundManager {
        IRewardsDistributionRecipient recipient = _recipient;
        uint256 activeTokenCount = recipient.activeTokenCount();

        IERC20[] memory rewardTokens = new IERC20[](activeTokenCount);
        uint256[] memory currentIndexes = new uint256[](activeTokenCount);
        for (uint256 i = 0; i < activeTokenCount; i++) {
            currentIndexes[i] = recipient.getActiveIndex(i);
            IERC20 rewardToken =  recipient.getRewardToken(currentIndexes[i]);
            rewardTokens[i] = rewardToken;
        }
        uint256[] memory feeAmounts = protocolFeeCollector.getCollectedFeeAmounts(rewardTokens);
        protocolFeeCollector.withdrawCollectedFees(rewardTokens, feeAmounts, address(this));
 
        for (uint256 i = 0; i < activeTokenCount; i++) {
            if (feeAmounts[i] > 0) { 
                uint256 fundAmt = (feeAmounts[i] * fundPct) / 1000;
                uint256 teamAmt = (feeAmounts[i] * teamPct) / 1000;
                uint256 treasuaryAmt = (feeAmounts[i] * treasuaryPct) / 1000;

                if (teamAmt > 0) { 
                    teamBalance[address(rewardTokens[i])];
                }

                if (treasuaryAmt > 0) {
                    treasuaryBalance[address(rewardTokens[i])];
                }

                // Only after successful fee collcetion - notify the contract of the new funds
                if (fundAmt > 0) {
                    rewardTokens[i].safeTransfer(address(recipient), fundAmt);
                    recipient.notifyRewardAmount(currentIndexes[i], fundAmt);
                }

                emit DistributedReward(
                    address(recipient),
                    address(rewardTokens[i]),
                    feeAmounts[i]
                );
            }
        }
    }

    /**
     * @dev Distributes tokens to team
     * of the transfer. Only callable by FundManagers
     * @param _recipient   address of rewards recipient to add new reward token to
     * @param _rewardToken  Address of the reward token to claim
     */
    function addRewardToken(
        IRewardsDistributionRecipient _recipient,
        address _rewardToken
    ) external onlyFundManager {
         IRewardsDistributionRecipient recipient = _recipient;
        _recipient.add(_rewardToken);
    }



    /**
     * @dev Distributes tokens to team
     * of the transfer. Only callable by FundManagers
     * @param _recipient   address of rewards recipient to add new reward token to
     * @param _rewardToken  Address of the reward token to add
     * @param _index  Index if alreayd existing token
     */
    function distrubutePendingReward(
        IRewardsDistributionRecipient _recipient,
        address _rewardToken,
        uint256 _index
    ) external onlyFundManager { 
        IRewardsDistributionRecipient recipient = _recipient;

        uint256 pending = recipient.pendingAdditionalReward(_index);
        if (pending > 0) { 
            recipient.notifyRewardAmount(_index, 0);
        }
    }

    /**
     * @dev Distributes tokens to team
     * of the transfer. Only callable by FundManagers
     * @param _recipient   address of rewards recipient to add new reward token to
     * @param _id  active reward info index to update
     * @param _rewardToken  Address of the reward token to add
     * @param _index  Index if alreayd existing token
     */
    function updateRewardToken(
        IRewardsDistributionRecipient _recipient,
        uint256 _id, 
        address _rewardToken,
        uint256 _index
    ) external onlyFundManager {
         IRewardsDistributionRecipient recipient = _recipient;
        _recipient.update(_id, _rewardToken, _index);
    }

     /**
     * @dev Distributes reward tokens to list of recipients and notifies them
     * of the transfer. Only callable by FundManagers
     * @param _recipient        Reward recipient to credit
     */
    function distributeRewards(
        IRewardsDistributionRecipient _recipient,
        uint256[] calldata _amounts,
        uint256[] calldata _indexes
    ) external onlyFundManager {
        uint256 len = _indexes.length;
        require(len == _amounts.length, "Mismatching inputs");
        IRewardsDistributionRecipient recipient = _recipient;
        for (uint256 i = 0; i < len; i++) {
            IERC20 rewardToken =  recipient.getRewardToken(_indexes[i]);
            rewardToken.safeTransferFrom(msg.sender, address(recipient), _amounts[i]);
            recipient.notifyRewardAmount(_indexes[i], _amounts[i]);

            emit DistributedReward(
                address(recipient),
                address(rewardToken),
                _amounts[i]
            );
        }

    }

    /**
     * @dev Distributes tokens to team
     * of the transfer. Only callable by FundManagers
     * @param _addr   Address to send reward to
     * @param _token  Address of the reward token to claim
     */
    function withdrawTeam(address _addr, address _token) 
        external 
        onlyTeamManager 
    {
        uint256 _teamBalance = teamBalance[_token];
        if (_teamBalance > 0) { 
            uint256 balance = IERC20(_token).balanceOf(address(this));
            if (balance > 0 && balance >= _teamBalance) {
                teamBalance[_token] = 0;
                IERC20(_token).safeTransfer(_addr, _teamBalance);
            }
        }
    }

    /**
     * @dev Distributes tokens to team
     * of the transfer. Only callable by FundManagers
     * @param _addr   Address to send reward to
     * @param _token  Address of the reward token to claim
     */
    function withdrawTreasuary(address _addr, address _token) 
        external 
        onlyTreasuaryManager 
    {
        uint256 _treasuaryBalance = treasuaryBalance[_token];
        if (_treasuaryBalance > 0) { 
            uint256 balance = IERC20(_token).balanceOf(address(this));
            if (balance > 0 && balance >= _treasuaryBalance) {
                treasuaryBalance[_token] = 0;
                IERC20(_token).safeTransfer(_addr, _treasuaryBalance);
            }
        }
    }

     /**
     * @dev Set payout distrubution percentages
     * @param _teamPct Team fund percentage
     * @param _fundPct xEmbr fund percentage
     * @param _treasuaryPct Treasuary fund percentage
     */
    function setPayoutDistrubution(uint256 _teamPct, uint256 _fundPct, uint256 _treasuaryPct) external onlyFundManager {
        require(_teamPct + _fundPct + _treasuaryPct == 1000, "Distrubtion percent is not 1000");

        teamPct = _teamPct; 
        fundPct = _fundPct;
        treasuaryPct = _treasuaryPct;

        emit UpdatePayoutPercentages(teamPct, fundPct, treasuaryPct);
    }

}
