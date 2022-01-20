// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.6;

import { IRewardsRecipient } from "../interfaces/IRewardsDistributionRecipient.sol";
import { ImmutableModule } from "../shared/ImmutableModule.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IProtocolFeeCollector } from "../interfaces/IProtocolFeeCollector.sol";


/**
 * @title  RewardsDistributor
 * @author Embr
 * @notice RewardsDistributor allows Fund Managers to send rewards
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

    event AddedManager(address indexed _address);
    event RemovedManager(address indexed _address);
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
        uint256 _teamPercentage,
        uint256 _xembrPercentage,
        uint256 _treasuaryPercentage
    ) ImmutableModule(_fulcrum) {
        require(_teamPercentage + _xembrPercentage + _treasuaryPercentage == 1000, "Distrubtion percent is not 1000");

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

        teamPercentage = _teamPercentage;
        xembrPercentage = _xembrPercentage;
        treasuaryPercentage = _treasuaryPercentage;
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
        IRewardsRecipient _recipient
    ) external onlyFundManager {
        IRewardsRecipientWithPlatformToken recipient = _recipient;
        uint256 activeTokenCount = recipient.activeTokenCount();

        IERC20[] memory rewardTokens = new IERC20[](activeTokenCount);
        uint256[] memory currentIndexes = new uint256[](activeTokenCount);
        for (uint256 i = 0; i < activeTokenCount; i++) {
            currentIndexes[i] = recipient.getActiveIndex(i);
            IERC20 rewardToken =  recipient.getRewardToken(currentIndexes[i]);
            rewardTokens[i] = rewardToken;
        }
        uint256[] memory feeAmounts = protocolFeeCollector.getCollectedFeeAmounts(rewardTokens);
        protocolFeeCollector.withdrawCollectedFees(rewardTokens, feeAmounts, address(_recipient));
 
        for (uint256 i = 0; i < activeTokenCount; i++) {
            if (feeAmounts[i] > 0) { 
                uint256 fundAmt = (balance * fundPct) / 1000;
                uint256 teamAmt = (balance * teamPct) / 1000;
                uint256 treasuaryAmt = (balance * treasuaryPct) / 1000;

                if (teamAmt > 0) { 
                    teamBalance[address(rewardTokens[i])];
                }

                if (treasuaryAmt > 0) {
                    treasuaryBalance[address(rewardTokens[i])];
                }

                // Only after successful fee collcetion - notify the contract of the new funds
                recipient.notifyRewardAmount(currentIndexes[i], feeAmounts[i]);

                emit DistributedReward(
                    address(recipient),
                    address(rewardToken),
                    amount
                );
            }
        }
    }

     /**
     * @dev Distributes reward tokens to list of recipients and notifies them
     * of the transfer. Only callable by FundManagers
     * @param _recipient        Reward recipient to credit
     */
    function distributeRewards(
        IRewardsRecipient _recipient,
        uint256[] calldata _amounts,
        uint256[] calldata _indexes,
    ) external onlyFundManager {
        uint256 len = _indexes.length;
         require(len == _amounts.length, "Mismatching inputs");
        IRewardsRecipientWithPlatformToken recipient = _recipient;
        for (uint256 i = 0; i < len; i++) {
            IERC20 rewardToken =  recipient.getRewardToken(i);
            rewardToken.safeTransferFrom(msg.sender, address(recipient), amount);
            recipient.notifyRewardAmount(i, amount);

            emit DistributedReward(
                address(recipient),
                address(rewardToken),
                amount
            );
        }

    }
}
