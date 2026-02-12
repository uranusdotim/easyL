// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title EasyLVault
/// @notice A vault where users deposit USDC and receive EASYL receipt tokens.
///         The owner deploys USDC for market making; profits/losses adjust share price.
contract EasyLVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ──────────────────── Constants ────────────────────
    // solhint-disable-next-line var-name-mixedcase
    IERC20 public immutable USDC;
    uint8 private constant _DECIMALS = 6;
    uint256 private constant VIRTUAL_OFFSET = 1e3;

    // ──────────────────── State ────────────────────
    uint256 public managedAssets;

    // ──────────────────── Events ────────────────────
    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Redeem(address indexed caller, address indexed receiver, uint256 shares, uint256 assets);
    event FundsDeployed(uint256 amount);
    event FundsReturned(uint256 amount);
    event PnLReported(int256 amount, uint256 newManagedAssets);

    // ──────────────────── Errors ────────────────────
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error ExcessiveReduction(uint256 reduction, uint256 managed);

    // ──────────────────── Constructor ────────────────────
    constructor(address _usdc, address _owner) ERC20("easyL Share", "EASYL") Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        USDC = IERC20(_usdc);
    }

    // ──────────────────── View functions ────────────────────

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Total USDC controlled by the vault (held + deployed)
    function totalAssets() public view returns (uint256) {
        return USDC.balanceOf(address(this)) + managedAssets;
    }

    /// @notice USDC currently available for redemptions
    function availableLiquidity() public view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /// @notice Convert a USDC amount to EASYL shares (floor rounding)
    function convertToShares(uint256 assets) public view returns (uint256) {
        return assets.mulDiv(totalSupply() + VIRTUAL_OFFSET, totalAssets() + VIRTUAL_OFFSET, Math.Rounding.Floor);
    }

    /// @notice Convert EASYL shares to USDC amount (floor rounding)
    function convertToAssets(uint256 shares) public view returns (uint256) {
        return shares.mulDiv(totalAssets() + VIRTUAL_OFFSET, totalSupply() + VIRTUAL_OFFSET, Math.Rounding.Floor);
    }

    /// @notice USDC value of 1 EASYL (scaled to 6 decimals)
    function sharePrice() external view returns (uint256) {
        return convertToAssets(10 ** _DECIMALS);
    }

    // ──────────────────── User actions ────────────────────

    /// @notice Deposit USDC and receive EASYL shares
    /// @param assets Amount of USDC to deposit
    /// @param receiver Address to receive the minted EASYL
    /// @return shares Amount of EASYL minted
    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        shares = convertToShares(assets);
        if (shares == 0) revert ZeroAmount();

        USDC.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Burn EASYL shares and receive proportional USDC
    /// @param shares Amount of EASYL to burn
    /// @param receiver Address to receive the USDC
    /// @return assets Amount of USDC returned
    function redeem(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        assets = convertToAssets(shares);
        if (assets == 0) revert ZeroAmount();

        uint256 liquidity = availableLiquidity();
        if (assets > liquidity) revert InsufficientLiquidity(assets, liquidity);

        _burn(msg.sender, shares);
        USDC.safeTransfer(receiver, assets);

        emit Redeem(msg.sender, receiver, shares, assets);
    }

    // ──────────────────── Owner actions ────────────────────

    /// @notice Owner withdraws USDC for market making
    function deployFunds(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 liquidity = availableLiquidity();
        if (amount > liquidity) revert InsufficientLiquidity(amount, liquidity);

        managedAssets += amount;
        USDC.safeTransfer(msg.sender, amount);

        emit FundsDeployed(amount);
    }

    /// @notice Owner returns USDC from market making
    function returnFunds(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > managedAssets) revert ExcessiveReduction(amount, managedAssets);

        managedAssets -= amount;
        USDC.safeTransferFrom(msg.sender, address(this), amount);

        emit FundsReturned(amount);
    }

    /// @notice Report profit or loss from market making (adjusts share price)
    /// @param amount Positive for profit, negative for loss
    function reportPnL(int256 amount) external onlyOwner {
        if (amount > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            managedAssets += uint256(amount);
        } else if (amount < 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 loss = uint256(-amount);
            if (loss > managedAssets) revert ExcessiveReduction(loss, managedAssets);
            managedAssets -= loss;
        }

        emit PnLReported(amount, managedAssets);
    }
}
