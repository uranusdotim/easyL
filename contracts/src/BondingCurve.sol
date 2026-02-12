// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title BondingCurve
/// @notice A pump.fun-style token launcher with a linear bonding curve and USDC as the reserve currency.
///         Price increases linearly with supply: price(s) = BASE_PRICE + SLOPE * s / SCALE
contract BondingCurve is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ──────────────────── Constants ────────────────────
    IERC20 public immutable usdc;
    uint256 public constant BASE_PRICE = 10_000;  // 0.01 USDC (6-decimal terms)
    uint256 public constant SLOPE = 10_000;        // price increases 0.01 USDC per whole token
    uint256 private constant SCALE = 1e6;          // 10^decimals

    // ──────────────────── State ────────────────────
    uint256 public reserveBalance;

    // ──────────────────── Events ────────────────────
    event TokensBought(address indexed buyer, uint256 usdcIn, uint256 tokensOut);
    event TokensSold(address indexed seller, uint256 tokensBurned, uint256 usdcOut);

    // ──────────────────── Errors ────────────────────
    error ZeroAmount();
    error InsufficientTokens(uint256 requested, uint256 available);

    // ──────────────────── Constructor ────────────────────
    constructor(address _usdc) ERC20("RobinPump Sim", "RSIM") {
        usdc = IERC20(_usdc);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // ──────────────────── View functions ────────────────────

    /// @notice Current price per whole token based on totalSupply: BASE_PRICE + SLOPE * totalSupply / SCALE
    function getPrice() external view returns (uint256) {
        return BASE_PRICE + (SLOPE * totalSupply()) / SCALE;
    }

    /// @notice USDC cost to buy `tokenAmount` tokens at current supply.
    ///         Integral from s0 to s1 of (BASE_PRICE + SLOPE * s) ds
    ///         = BASE_PRICE * (s1 - s0) + SLOPE/2 * (s1^2 - s0^2)
    function getBuyCost(uint256 tokenAmount) public view returns (uint256) {
        if (tokenAmount == 0) return 0;
        uint256 s0 = totalSupply();
        uint256 s1 = s0 + tokenAmount;
        return _integralCost(s0, s1);
    }

    /// @notice USDC returned for selling `tokenAmount` tokens at current supply.
    ///         Integral from (s0 - tokenAmount) to s0 of (BASE_PRICE + SLOPE * s) ds
    function getSellReturn(uint256 tokenAmount) public view returns (uint256) {
        if (tokenAmount == 0) return 0;
        uint256 s0 = totalSupply();
        if (tokenAmount > s0) revert InsufficientTokens(tokenAmount, s0);
        uint256 s1 = s0 - tokenAmount;
        return _integralCost(s1, s0);
    }

    // ──────────────────── User actions ────────────────────

    /// @notice Send USDC, receive tokens calculated from the curve
    /// @param usdcAmount Amount of USDC to spend
    /// @return tokenAmount Tokens minted to the buyer
    function buy(uint256 usdcAmount) external nonReentrant returns (uint256 tokenAmount) {
        if (usdcAmount == 0) revert ZeroAmount();

        tokenAmount = _tokensForExactUsdc(usdcAmount);
        if (tokenAmount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        reserveBalance += usdcAmount;
        _mint(msg.sender, tokenAmount);

        emit TokensBought(msg.sender, usdcAmount, tokenAmount);
    }

    /// @notice Burn tokens, receive USDC calculated from the curve
    /// @param tokenAmount Amount of tokens to sell
    /// @return usdcAmount USDC returned to the seller
    function sell(uint256 tokenAmount) external nonReentrant returns (uint256 usdcAmount) {
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokenAmount > balanceOf(msg.sender)) {
            revert InsufficientTokens(tokenAmount, balanceOf(msg.sender));
        }

        usdcAmount = getSellReturn(tokenAmount);
        if (usdcAmount == 0) revert ZeroAmount();

        _burn(msg.sender, tokenAmount);
        reserveBalance -= usdcAmount;
        usdc.safeTransfer(msg.sender, usdcAmount);

        emit TokensSold(msg.sender, tokenAmount, usdcAmount);
    }

    // ──────────────────── Internal ────────────────────

    /// @dev Cost integral from supply sLow to sHigh (raw units):
    ///      BASE_PRICE * delta / SCALE + SLOPE * (sHigh^2 - sLow^2) / (2 * SCALE^2)
    function _integralCost(uint256 sLow, uint256 sHigh) internal pure returns (uint256) {
        uint256 delta = sHigh - sLow;
        uint256 linearPart = Math.mulDiv(BASE_PRICE, delta, SCALE);
        uint256 quadPart = Math.mulDiv(SLOPE * (sHigh + sLow), delta, 2 * SCALE * SCALE);
        return linearPart + quadPart;
    }

    /// @dev Given exact USDC input, compute tokens to mint.
    ///      Integral cost: BASE_PRICE * t / SCALE + SLOPE * (2*s0*t + t^2) / (2 * SCALE^2) = usdcAmount
    ///      Multiply by 2*SCALE^2:  SLOPE*t^2 + 2*(BASE_PRICE*SCALE + SLOPE*s0)*t - 2*SCALE^2*usdcAmount = 0
    ///      Let b = SCALE*BASE_PRICE + SLOPE*s0
    ///      t = (-b + sqrt(b^2 + 2*SLOPE*SCALE^2*usdcAmount)) / SLOPE
    function _tokensForExactUsdc(uint256 usdcAmount) internal view returns (uint256) {
        uint256 s0 = totalSupply();
        uint256 b = SCALE * BASE_PRICE + SLOPE * s0;
        uint256 discriminant = b * b + 2 * SLOPE * SCALE * SCALE * usdcAmount;
        uint256 sqrtDisc = Math.sqrt(discriminant);
        if (sqrtDisc <= b) return 0;
        return (sqrtDisc - b) / SLOPE;
    }
}
