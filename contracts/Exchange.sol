//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFactory {
    function getExchange(address token_addr) external returns (address);
}

interface IExchange {
    // function ethToTokenSwap(uint256 _minTokens) external payable;

    // function ethToTokenTransfer(
    //     uint256 _minTokens,
    //     address _recipient
    // ) external payable;

    function addLiquidity(uint256 min_liquidity, uint256 max_tokens, uint256 deadline) external payable returns (uint256);
    function removeLiquidity(uint256 amount, uint256 min_eth, uint256 min_tokens, uint256 deadline) external returns (uint256, uint256);

    event AddLiquidity(address indexed provider, uint256 indexed eth_amount, uint256 indexed token_amount);
    event RemoveLiquidity(address indexed provider, uint256 indexed eth_amount, uint256 indexed token_amount);
    
}

contract Exchange is ERC20, IExchange {
    IERC20 public token;
    IFactory public factory;

    constructor(address token_addr) ERC20("Uniswap V1", "UNI-V1") {
        require(token_addr != address(0), "invalid token address");
        token = IERC20(token_addr);
        factory = IFactory(msg.sender);
    }

      /**
   * @notice Deposit ETH and Tokens (self.token) at current ratio to mint UNI tokens.
   * @dev min_liquidity does nothing when total UNI supply is 0.
   * @param min_liquidity Minimum number of UNI sender will mint if total UNI supply is greater than 0.
   * @param max_tokens Maximum number of tokens deposited. Deposits max amount if total UNI supply is 0.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return The amount of UNI minted.
    */
    function addLiquidity(
        uint256 min_liquidity,
        uint256 max_tokens,
        uint256 deadline
    ) public payable returns (uint256) {
        require(deadline > block.timestamp, "deadline reached");
        uint256 total_liquidity = totalSupply();
        if (total_liquidity > 0) {
            require(min_liquidity > 0, "min_liquidity must be greater than 0");
            uint256 eth_reserve = address(this).balance - msg.value;
            uint256 token_reserve = token.balanceOf(address(this));
            uint256 token_amount = ((msg.value * token_reserve) / eth_reserve) +
                1;
            uint256 liquidity_minted = (msg.value * total_liquidity) /
                eth_reserve;
            require(max_tokens >= token_amount, "insufficient token amount");
            require(
                liquidity_minted >= min_liquidity,
                "insufficient liquidity provided"
            );
            token.transferFrom(msg.sender, address(this), token_amount);
            _mint(msg.sender, liquidity_minted);
            emit AddLiquidity(msg.sender, msg.value, token_amount);
            return liquidity_minted;
        } else {
            require(
                msg.value >= 1000000000,
                "need more than 1000000000 wei to create pool"
            );
            token.transferFrom(msg.sender, address(this), max_tokens);
            uint256 initial_liquidity = address(this).balance;
            _mint(msg.sender, initial_liquidity);
            emit AddLiquidity(msg.sender, msg.value, max_tokens);
            return initial_liquidity;
        }
    }

      /**
   * @dev Burn UNI tokens to withdraw ETH && Tokens at current ratio.
   * @param amount Amount of UNI burned.
   * @param min_eth Minimum ETH withdrawn.
   * @param min_tokens Minimum Tokens withdrawn.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return The amount of ETH && Tokens withdrawn.
   */
  function removeLiquidity(uint256 amount, uint256 min_eth, uint256 min_tokens, uint256 deadline) public returns (uint256, uint256) {
    require(amount > 0 && deadline > block.timestamp && min_eth > 0 && min_tokens > 0);
    uint256 total_liquidity = totalSupply();
    require(total_liquidity > 0);
    uint256 token_reserve = token.balanceOf(address(this));
    uint256 eth_amount = (amount * address(this).balance) / total_liquidity;
    uint256 token_amount = (amount * token_reserve) / total_liquidity;
    require(eth_amount >= min_eth && token_amount >= min_tokens);
    _burn(msg.sender, amount);
    payable(msg.sender).transfer(eth_amount);
    require(token.transfer(msg.sender, token_amount));
    emit RemoveLiquidity(msg.sender, eth_amount, token_amount);
    return (eth_amount, token_amount);
  }
}
