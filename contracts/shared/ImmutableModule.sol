// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.6;

import { ModuleKeys } from "./ModuleKeys.sol";
import { IFulcrum } from "../interfaces/IFulcrum.sol";

/**
 * @title   ImmutableModule
 * @author  mStable
 * @dev     Subscribes to module updates from a given publisher and reads from its registry.
 *          Contract is used for upgradable proxy contracts.
 */
abstract contract ImmutableModule is ModuleKeys {
    IFulcrum public immutable fulcrum;

    /**
     * @dev Initialization function for upgradable proxy contracts
     * @param _fulcrum Fulcrum contract address
     */
    constructor(address _fulcrum) {
        require(_fulcrum != address(0), "Fulcrum address is zero");
        fulcrum = IFulcrum(_fulcrum);
    }

    /**
     * @dev Modifier to allow function calls only from the Governor.
     */
    modifier onlyGovernor() {
        _onlyGovernor();
        _;
    }

    function _onlyGovernor() internal view {
        require(msg.sender == _governor(), "Only governor can execute");
    }

    /**
     * @dev Modifier to allow function calls only from the Governor or the Keeper EOA.
     */
    modifier onlyKeeperOrGovernor() {
        _keeperOrGovernor();
        _;
    }

    function _keeperOrGovernor() internal view {
        require(msg.sender == _keeper() || msg.sender == _governor(), "Only keeper or governor");
    }

    /**
     * @dev Modifier to allow function calls only from the Governance.
     *      Governance is either Governor address or Governance address.
     */
    modifier onlyGovernance() {
        require(
            msg.sender == _governor() || msg.sender == _governance(),
            "Only governance can execute"
        );
        _;
    }

    /**
     * @dev Returns Governor address from the Fulcrum
     * @return Address of Governor Contract
     */
    function _governor() internal view returns (address) {
        return fulcrum.governor();
    }

    /**
     * @dev Returns Governance Module address from the Fulcrum
     * @return Address of the Governance (Phase 2)
     */
    function _governance() internal view returns (address) {
        return fulcrum.getModule(KEY_GOVERNANCE);
    }

    /**
     * @dev Return Keeper address from the Fulcrum.
     *      This account is used for operational transactions that
     *      don't need multiple signatures.
     * @return  Address of the Keeper externally owned account.
     */
    function _keeper() internal view returns (address) {
        return fulcrum.getModule(KEY_KEEPER);
    }

    /**
     * @dev Return ProxyAdmin Module address from the Fulcrum
     * @return Address of the ProxyAdmin Module contract
     */
    function _proxyAdmin() internal view returns (address) {
        return fulcrum.getModule(KEY_PROXY_ADMIN);
    }
}
