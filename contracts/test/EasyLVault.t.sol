// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {EasyLVault} from "../src/EasyLVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock USDC with 6 decimals
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract EasyLVaultTest is Test {
    EasyLVault public vault;
    MockUSDC public usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;
    uint256 constant THOUSAND_USDC = 1000e6;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new EasyLVault(address(usdc), owner);

        // Fund users
        usdc.mint(alice, 100_000 * ONE_USDC);
        usdc.mint(bob, 100_000 * ONE_USDC);
        usdc.mint(owner, 100_000 * ONE_USDC);

        // Approve vault
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(owner);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ──────────────── Constructor tests ────────────────

    function test_constructor_setsToken() public view {
        assertEq(address(vault.USDC()), address(usdc));
    }

    function test_constructor_setsOwner() public view {
        assertEq(vault.owner(), owner);
    }

    function test_constructor_setsNameAndSymbol() public view {
        assertEq(vault.name(), "easyL Share");
        assertEq(vault.symbol(), "EASYL");
    }

    function test_constructor_setsDecimals() public view {
        assertEq(vault.decimals(), 6);
    }

    function test_constructor_revertsZeroAddress() public {
        vm.expectRevert(EasyLVault.ZeroAddress.selector);
        new EasyLVault(address(0), owner);
    }

    // ──────────────── Deposit tests ────────────────

    function test_deposit_firstDeposit() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(THOUSAND_USDC, alice);

        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), THOUSAND_USDC);
        assertEq(usdc.balanceOf(address(vault)), THOUSAND_USDC);
    }

    function test_deposit_firstDepositSharesApproxEqual() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(THOUSAND_USDC, alice);

        // With virtual offset of 1e3, first deposit of 1000e6:
        // shares = 1000e6 * (0 + 1e3) / (0 + 1e3) = 1000e6
        assertEq(shares, THOUSAND_USDC);
    }

    function test_deposit_multipleDeposits() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(bob);
        uint256 bobShares = vault.deposit(THOUSAND_USDC, bob);

        // Second deposit at 1:1 ratio should get same shares
        assertEq(bobShares, THOUSAND_USDC);
        assertEq(vault.totalSupply(), 2 * THOUSAND_USDC);
    }

    function test_deposit_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit EasyLVault.Deposit(alice, alice, THOUSAND_USDC, THOUSAND_USDC);
        vault.deposit(THOUSAND_USDC, alice);
    }

    function test_deposit_toDifferentReceiver() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, bob);

        assertEq(vault.balanceOf(bob), THOUSAND_USDC);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_deposit_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(EasyLVault.ZeroAmount.selector);
        vault.deposit(0, alice);
    }

    function test_deposit_revertsZeroReceiver() public {
        vm.prank(alice);
        vm.expectRevert(EasyLVault.ZeroAddress.selector);
        vault.deposit(THOUSAND_USDC, address(0));
    }

    // ──────────────── Redeem tests ────────────────

    function test_redeem_fullRedeem() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 assets = vault.redeem(aliceShares, alice);

        // Floor rounding means might lose dust
        assertApproxEqAbs(assets, THOUSAND_USDC, 1);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_redeem_partialRedeem() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        uint256 halfShares = vault.balanceOf(alice) / 2;
        vm.prank(alice);
        uint256 assets = vault.redeem(halfShares, alice);

        assertApproxEqAbs(assets, THOUSAND_USDC / 2, 1);
        assertGt(vault.balanceOf(alice), 0);
    }

    function test_redeem_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        uint256 shares = vault.balanceOf(alice);
        uint256 expectedAssets = vault.convertToAssets(shares);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit EasyLVault.Redeem(alice, alice, shares, expectedAssets);
        vault.redeem(shares, alice);
    }

    function test_redeem_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(EasyLVault.ZeroAmount.selector);
        vault.redeem(0, alice);
    }

    function test_redeem_revertsZeroReceiver() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(alice);
        vm.expectRevert(EasyLVault.ZeroAddress.selector);
        vault.redeem(THOUSAND_USDC, address(0));
    }

    function test_redeem_revertsInsufficientLiquidity() public {
        // Alice deposits, owner deploys all funds
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(owner);
        vault.deployFunds(THOUSAND_USDC);

        // Compute balance and expected assets before expectRevert
        uint256 aliceShares = vault.balanceOf(alice);
        uint256 expectedAssets = vault.convertToAssets(aliceShares);

        // Alice tries to redeem but no liquidity
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(EasyLVault.InsufficientLiquidity.selector, expectedAssets, 0)
        );
        vault.redeem(aliceShares, alice);
    }

    // ──────────────── Deploy/Return funds tests ────────────────

    function test_deployFunds_success() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        uint256 deployAmt = 500 * ONE_USDC;
        vm.prank(owner);
        vault.deployFunds(deployAmt);

        assertEq(vault.managedAssets(), deployAmt);
        assertEq(vault.availableLiquidity(), THOUSAND_USDC - deployAmt);
        assertEq(vault.totalAssets(), THOUSAND_USDC); // unchanged
        assertEq(usdc.balanceOf(owner), 100_000 * ONE_USDC + deployAmt);
    }

    function test_deployFunds_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit EasyLVault.FundsDeployed(500 * ONE_USDC);
        vault.deployFunds(500 * ONE_USDC);
    }

    function test_deployFunds_revertsNonOwner() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(alice);
        vm.expectRevert();
        vault.deployFunds(100 * ONE_USDC);
    }

    function test_deployFunds_revertsZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(EasyLVault.ZeroAmount.selector);
        vault.deployFunds(0);
    }

    function test_deployFunds_revertsInsufficientLiquidity() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(EasyLVault.InsufficientLiquidity.selector, THOUSAND_USDC + 1, THOUSAND_USDC)
        );
        vault.deployFunds(THOUSAND_USDC + 1);
    }

    function test_returnFunds_success() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        vm.prank(owner);
        vault.returnFunds(300 * ONE_USDC);

        assertEq(vault.managedAssets(), 200 * ONE_USDC);
        assertEq(vault.availableLiquidity(), 800 * ONE_USDC);
    }

    function test_returnFunds_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit EasyLVault.FundsReturned(300 * ONE_USDC);
        vault.returnFunds(300 * ONE_USDC);
    }

    function test_returnFunds_revertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.returnFunds(100 * ONE_USDC);
    }

    function test_returnFunds_revertsExcessiveAmount() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(EasyLVault.ExcessiveReduction.selector, 501 * ONE_USDC, 500 * ONE_USDC)
        );
        vault.returnFunds(501 * ONE_USDC);
    }

    // ──────────────── PnL tests ────────────────

    function test_reportPnL_profit() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        // Report 100 USDC profit
        vm.prank(owner);
        vault.reportPnL(int256(100 * ONE_USDC));

        assertEq(vault.managedAssets(), 600 * ONE_USDC);
        assertEq(vault.totalAssets(), 1100 * ONE_USDC);
    }

    function test_reportPnL_loss() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        // Report 100 USDC loss
        vm.prank(owner);
        vault.reportPnL(-int256(100 * ONE_USDC));

        assertEq(vault.managedAssets(), 400 * ONE_USDC);
        assertEq(vault.totalAssets(), 900 * ONE_USDC);
    }

    function test_reportPnL_zero() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        vm.prank(owner);
        vault.reportPnL(0);

        assertEq(vault.managedAssets(), 500 * ONE_USDC);
    }

    function test_reportPnL_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit EasyLVault.PnLReported(int256(100 * ONE_USDC), 600 * ONE_USDC);
        vault.reportPnL(int256(100 * ONE_USDC));
    }

    function test_reportPnL_revertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.reportPnL(int256(100 * ONE_USDC));
    }

    function test_reportPnL_revertsExcessiveLoss() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(EasyLVault.ExcessiveReduction.selector, 501 * ONE_USDC, 500 * ONE_USDC)
        );
        vault.reportPnL(-int256(501 * ONE_USDC));
    }

    // ──────────────── Share price / accounting tests ────────────────

    function test_sharePrice_initiallyOneToOne() public view {
        // With no deposits, share price is 1e6 (1 USDC per share)
        assertEq(vault.sharePrice(), ONE_USDC);
    }

    function test_sharePrice_increasesWithProfit() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        uint256 priceBefore = vault.sharePrice();

        vm.prank(owner);
        vault.reportPnL(int256(500 * ONE_USDC));

        uint256 priceAfter = vault.sharePrice();
        assertGt(priceAfter, priceBefore);
    }

    function test_sharePrice_decreasesWithLoss() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        uint256 priceBefore = vault.sharePrice();

        vm.prank(owner);
        vault.reportPnL(-int256(200 * ONE_USDC));

        uint256 priceAfter = vault.sharePrice();
        assertLt(priceAfter, priceBefore);
    }

    function test_profitSharedBetweenDepositors() public {
        // Alice deposits 1000
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        // Bob deposits 1000
        vm.prank(bob);
        vault.deposit(THOUSAND_USDC, bob);

        // Owner deploys and makes profit
        vm.prank(owner);
        vault.deployFunds(1000 * ONE_USDC);
        vm.prank(owner);
        vault.reportPnL(int256(500 * ONE_USDC));

        // Both should have roughly equal value
        uint256 aliceValue = vault.convertToAssets(vault.balanceOf(alice));
        uint256 bobValue = vault.convertToAssets(vault.balanceOf(bob));
        assertApproxEqAbs(aliceValue, bobValue, 1);
        assertGt(aliceValue, THOUSAND_USDC); // worth more than deposited
    }

    // ──────────────── Inflation attack protection ────────────────

    function test_inflationAttack_protected() public {
        // Attacker deposits 1 wei of USDC
        usdc.mint(address(this), 1);
        usdc.approve(address(vault), 1);
        vault.deposit(1, address(this));

        // Attacker donates a large amount directly to vault
        usdc.mint(address(this), 10_000 * ONE_USDC);
        usdc.transfer(address(vault), 10_000 * ONE_USDC);

        // Victim deposits 1000 USDC — should still get reasonable shares
        vm.prank(alice);
        uint256 shares = vault.deposit(THOUSAND_USDC, alice);

        // Shares should be non-trivial (not rounding to 0)
        assertGt(shares, 0);

        // Victim's redeemable value should be close to deposited amount
        uint256 redeemable = vault.convertToAssets(shares);
        // With virtual offset protection, loss should be minimal
        assertGt(redeemable, THOUSAND_USDC * 99 / 100); // at least 99% preserved
    }

    // ──────────────── Edge cases ────────────────

    function test_convertToShares_emptyVault() public view {
        uint256 shares = vault.convertToShares(THOUSAND_USDC);
        assertEq(shares, THOUSAND_USDC);
    }

    function test_convertToAssets_emptyVault() public view {
        uint256 assets = vault.convertToAssets(THOUSAND_USDC);
        assertEq(assets, THOUSAND_USDC);
    }

    function test_totalAssets_includesManagedAssets() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        assertEq(vault.totalAssets(), THOUSAND_USDC);
        assertEq(vault.availableLiquidity(), 500 * ONE_USDC);
    }

    function test_redeemAfterPartialDeploy() public {
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        // Owner deploys half
        vm.prank(owner);
        vault.deployFunds(500 * ONE_USDC);

        // Alice redeems half her shares (should work since 500 USDC still in vault)
        uint256 halfShares = vault.balanceOf(alice) / 2;
        vm.prank(alice);
        uint256 assets = vault.redeem(halfShares, alice);

        assertApproxEqAbs(assets, 500 * ONE_USDC, 1);
    }

    // ──────────────── Fuzz tests ────────────────

    function testFuzz_depositRedeem_roundTrip(uint256 amount) public {
        amount = bound(amount, 1, 50_000 * ONE_USDC);

        vm.prank(alice);
        uint256 shares = vault.deposit(amount, alice);

        vm.prank(alice);
        uint256 returned = vault.redeem(shares, alice);

        // Floor rounding: returned <= deposited
        assertLe(returned, amount);
        // But loss should be minimal (at most 1 wei due to rounding)
        assertApproxEqAbs(returned, amount, 1);
    }

    function testFuzz_convertRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, 1e18);

        // Deposit some baseline liquidity first
        vm.prank(alice);
        vault.deposit(THOUSAND_USDC, alice);

        uint256 shares = vault.convertToShares(amount);
        uint256 assets = vault.convertToAssets(shares);

        // Floor rounding both ways: assets <= original amount
        assertLe(assets, amount);
    }
}
