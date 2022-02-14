pragma solidity 0.8.6;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IProtocolFeeCollector } from "../../interfaces/IProtocolFeeCollector.sol";

contract MockProtocolFeeCollector is IProtocolFeeCollector 
{
    using SafeERC20 for IERC20;

    uint256 swapFeePercentage = 0;
    uint256 flashLoanFeePercentage = 0;

    constructor() {
    }


    function withdrawCollectedFees(
        IERC20[] calldata tokens,
        uint256[] calldata amounts,
        address recipient
    ) 
        external 
        override(IProtocolFeeCollector) 
    {
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) { 
            uint256 reward = tokens[i].balanceOf(address(this));
            if (reward > 0) { 
                tokens[i].safeTransfer(recipient, reward);
            }
        }
    }

    function getCollectedFeeAmounts(IERC20[] memory tokens) 
        external 
        view  
        override(IProtocolFeeCollector)  
        returns (uint256[] memory feeAmounts) 
    {
        uint256 len = tokens.length;
        feeAmounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) { 
            uint256 balance = tokens[i].balanceOf(address(this));
            feeAmounts[i] = balance;
        }
        return feeAmounts;
    }


    function setSwapFeePercentage(uint256 newSwapFeePercentage) 
        external
        override(IProtocolFeeCollector) 
    {
        swapFeePercentage = newSwapFeePercentage;
        emit SwapFeePercentageChanged(newSwapFeePercentage);
    }

    function setFlashLoanFeePercentage(uint256 newFlashLoanFeePercentage) 
        external
        override(IProtocolFeeCollector) 
    {
        flashLoanFeePercentage = newFlashLoanFeePercentage;
        emit FlashLoanFeePercentageChanged(newFlashLoanFeePercentage);
    }


    function getSwapFeePercentage() 
        external 
        view 
        override(IProtocolFeeCollector) 
        returns (uint256)
    {
        return swapFeePercentage;
    }

    function getFlashLoanFeePercentage() 
        external 
        view  
        override(IProtocolFeeCollector) 
        returns (uint256)
    {
        return flashLoanFeePercentage;
    }

    
}