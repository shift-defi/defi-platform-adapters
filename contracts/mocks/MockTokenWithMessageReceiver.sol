// SPDX-License-Identifier: SHIFT-1.0
pragma solidity 0.8.21;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ITokenWithMessageReceiver} from "../bridge/ITokenWithMessageReceiver.sol";

contract MockTokenWithMessageReceiver is ITokenWithMessageReceiver {
    using SafeERC20 for IERC20;

    address public owner;

    event TokenWithMessageReceived(
        address indexed token,
        uint256 amount,
        bytes message
    );

    constructor() {
        owner = msg.sender;
    }

    function receiveTokenWithMessage(
        address token,
        uint256 amount,
        bytes calldata message
    ) external {
        IERC20(token).safeTransferFrom(msg.sender, owner, amount);
        emit TokenWithMessageReceived(token, amount, message);
    }
}
