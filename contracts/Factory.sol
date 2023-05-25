//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IFactory.sol";
import "./Exchange.sol";

contract Factory is IFactory {
    uint256 public tokenCount;
    mapping(address => address) internal token_to_exchange;
    mapping(address => address) internal exchange_to_token;
    mapping(uint256 => address) internal id_to_token;

    function createExchange(address token) external returns (address) {
        require(token != address(0), "invalid token address");
        require(
            token_to_exchange[token] == address(0),
            "exchange already exists"
        );
        Exchange exchange = new Exchange(token);
        token_to_exchange[token] = address(exchange);
        exchange_to_token[address(exchange)] = token;
        uint256 token_id = tokenCount + 1;
        tokenCount = token_id;
        id_to_token[token_id] = token;
        emit NewExchange(token, address(exchange));
        return address(exchange);
    }

    function getExchange(address token) external view returns (address) {
        return token_to_exchange[token];
    }

    function getToken(address exchange) external view returns (address) {
        return exchange_to_token[exchange];
    }

    function getTokenWithId(uint256 token_id) external view returns (address) {
        return id_to_token[token_id];
    }
}
