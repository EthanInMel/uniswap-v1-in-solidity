//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFactory {
    event NewExchange(address indexed token, address indexed exchange);

    function createExchange(address token) external returns (address);

    function getExchange(address token) external view returns (address);

    function getToken(address token) external view returns (address);

    function getTokenWithId(uint256 token_id) external view returns (address);
}
