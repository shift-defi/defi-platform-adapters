// SPDX-License-Identifier: SHIFT-1.0
pragma solidity ^0.8.20;

interface IMessageHandler {
    function handleReceiveMessage(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) external returns (bool);
}
