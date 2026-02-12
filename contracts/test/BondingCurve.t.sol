// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
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

contract BondingCurveTest is Test {
    BondingCurve public curve;
    MockUSDC public usdc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;
    uint256 constant THOUSAND_USDC = 1000e6;
    uint256 constant ONE_TOKEN = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        curve = new BondingCurve(address(usdc));

        // Fund users
        usdc.mint(alice, 1_000_000 * ONE_USDC);
        usdc.mint(bob, 1_000_000 * ONE_USDC);

        // Approve curve
        vm.prank(alice);
        usdc.approve(address(curve), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(curve), type(uint256).max);
    }

    // ──────────────── Constructor tests ────────────────

    function test_constructor_setsUsdc() public view {
        assertEq(address(curve.usdc()), address(usdc));
    }

    function test_constructor_setsNameAndSymbol() public view {
        assertEq(curve.name(), "RobinPump Sim");
        assertEq(curve.symbol(), "RSIM");
    }

    function test_constructor_decimals() public view {
        assertEq(curve.decimals(), 6);
    }

    function test_constructor_initialState() public view {
        assertEq(curve.totalSupply(), 0);
        assertEq(curve.reserveBalance(), 0);
    }

    // ──────────────── Price / cost view tests ────────────────

    function test_getPrice_initiallyBasePrice() public view {
        assertEq(curve.getPrice(), 10_000); // BASE_PRICE when supply = 0
    }

    function test_getBuyCost_zeroReturnsZero() public view {
        assertEq(curve.getBuyCost(0), 0);
    }

    function test_getSellReturn_zeroReturnsZero() public view {
        assertEq(curve.getSellReturn(0), 0);
    }

    function test_getSellReturn_revertsExcessiveAmount() public {
        // No tokens exist, selling 1 should revert
        vm.expectRevert(abi.encodeWithSelector(BondingCurve.InsufficientTokens.selector, 1, 0));
        curve.getSellReturn(1);
    }

    function test_getBuyCost_linearFormula() public view {
        // Buy 1 token (1e6 raw) from supply 0:
        // cost = BASE_PRICE * 1e6 / SCALE + SLOPE * (1e6)^2 / (2 * SCALE^2)
        //      = 10_000 + 5_000 = 15_000
        uint256 cost = curve.getBuyCost(ONE_TOKEN);
        assertEq(cost, 15_000);
    }

    function test_getBuyCost_atNonZeroSupply() public {
        // Buy first batch to move supply up
        vm.prank(alice);
        curve.buy(ONE_USDC); // buy some tokens

        uint256 supply = curve.totalSupply();
        assertGt(supply, 0);

        // Price should be higher now
        uint256 price = curve.getPrice();
        assertGt(price, 10_000);

        // Cost to buy more should be higher than from zero
        uint256 costFromZero = 15_000; // cost for 1 token from supply 0
        uint256 costNow = curve.getBuyCost(ONE_TOKEN);
        assertGt(costNow, costFromZero);
    }

    // ──────────────── Buy tests ────────────────

    function test_buy_firstBuy() public {
        vm.prank(alice);
        uint256 tokens = curve.buy(ONE_USDC);

        assertGt(tokens, 0);
        assertEq(curve.balanceOf(alice), tokens);
        assertEq(curve.reserveBalance(), ONE_USDC);
        assertEq(usdc.balanceOf(address(curve)), ONE_USDC);
    }

    function test_buy_multipleBuys() public {
        vm.prank(alice);
        uint256 tokens1 = curve.buy(ONE_USDC);

        vm.prank(bob);
        uint256 tokens2 = curve.buy(ONE_USDC);

        // Second buy should get fewer tokens (price increased)
        assertLt(tokens2, tokens1);
        assertEq(curve.reserveBalance(), 2 * ONE_USDC);
    }

    function test_buy_emitsEvent() public {
        vm.prank(alice);

        // We can't predict exact token amount, so just check event is emitted
        vm.expectEmit(true, false, false, false);
        emit BondingCurve.TokensBought(alice, 0, 0);
        curve.buy(ONE_USDC);
    }

    function test_buy_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(BondingCurve.ZeroAmount.selector);
        curve.buy(0);
    }

    function test_buy_priceIncreasesWithSupply() public {
        uint256 priceBefore = curve.getPrice();

        vm.prank(alice);
        curve.buy(10 * ONE_USDC);

        uint256 priceAfter = curve.getPrice();
        assertGt(priceAfter, priceBefore);
    }

    // ──────────────── Sell tests ────────────────

    function test_sell_afterBuy() public {
        vm.prank(alice);
        uint256 tokens = curve.buy(10 * ONE_USDC);

        uint256 usdcBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 usdcReturned = curve.sell(tokens);

        assertGt(usdcReturned, 0);
        assertEq(usdc.balanceOf(alice), usdcBefore + usdcReturned);
        assertEq(curve.balanceOf(alice), 0);
    }

    function test_sell_partialSell() public {
        vm.prank(alice);
        uint256 tokens = curve.buy(10 * ONE_USDC);

        uint256 halfTokens = tokens / 2;

        vm.prank(alice);
        uint256 usdcReturned = curve.sell(halfTokens);

        assertGt(usdcReturned, 0);
        assertGt(curve.balanceOf(alice), 0);
    }

    function test_sell_emitsEvent() public {
        vm.prank(alice);
        uint256 tokens = curve.buy(ONE_USDC);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit BondingCurve.TokensSold(alice, 0, 0);
        curve.sell(tokens);
    }

    function test_sell_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(BondingCurve.ZeroAmount.selector);
        curve.sell(0);
    }

    function test_sell_revertsInsufficientBalance() public {
        vm.prank(alice);
        curve.buy(ONE_USDC);

        uint256 aliceBalance = curve.balanceOf(alice);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BondingCurve.InsufficientTokens.selector, aliceBalance + 1, aliceBalance)
        );
        curve.sell(aliceBalance + 1);
    }

    function test_sell_priceFallsAfterSell() public {
        vm.prank(alice);
        uint256 tokens = curve.buy(10 * ONE_USDC);

        uint256 priceBefore = curve.getPrice();

        vm.prank(alice);
        curve.sell(tokens);

        uint256 priceAfter = curve.getPrice();
        assertLt(priceAfter, priceBefore);
    }

    // ──────────────── Round-trip / accounting tests ────────────────

    function test_buyThenSellAll_returnsLessOrEqualUsdc() public {
        // Due to integer rounding, selling all tokens should return <= original USDC
        uint256 usdcIn = 100 * ONE_USDC;
        vm.prank(alice);
        uint256 tokens = curve.buy(usdcIn);

        vm.prank(alice);
        uint256 usdcOut = curve.sell(tokens);

        // Should get back less or equal (rounding loss)
        assertLe(usdcOut, usdcIn);
        // But the loss should be small relative to the amount
        assertGt(usdcOut, (usdcIn * 99) / 100); // at least 99%
    }

    function test_reserveBalance_tracksCorrectly() public {
        vm.prank(alice);
        curve.buy(10 * ONE_USDC);
        assertEq(curve.reserveBalance(), 10 * ONE_USDC);

        vm.prank(bob);
        curve.buy(5 * ONE_USDC);
        assertEq(curve.reserveBalance(), 15 * ONE_USDC);

        uint256 bobTokens = curve.balanceOf(bob);
        vm.prank(bob);
        uint256 returned = curve.sell(bobTokens);
        assertEq(curve.reserveBalance(), 15 * ONE_USDC - returned);
    }

    function test_multiUserBuySell_priceMovement() public {
        // Alice buys first (cheap)
        vm.prank(alice);
        uint256 aliceTokens = curve.buy(10 * ONE_USDC);

        // Bob buys second (more expensive, gets fewer tokens)
        vm.prank(bob);
        uint256 bobTokens = curve.buy(10 * ONE_USDC);

        assertLt(bobTokens, aliceTokens);

        // Alice sells after Bob bought (price is higher), should profit
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        curve.sell(aliceTokens);
        uint256 aliceUsdcAfter = usdc.balanceOf(alice);

        uint256 aliceProfit = aliceUsdcAfter - aliceUsdcBefore;
        // Alice spent 10 USDC, sold at higher price so should get > 10 USDC
        assertGt(aliceProfit, 10 * ONE_USDC);
    }

    function test_supply_returnsToZero() public {
        vm.prank(alice);
        uint256 tokens = curve.buy(ONE_USDC);

        vm.prank(alice);
        curve.sell(tokens);

        // Supply should be 0 (or close to it depending on rounding)
        assertEq(curve.totalSupply(), 0);
        // Price should be back to base price
        assertEq(curve.getPrice(), 10_000);
    }

    // ──────────────── Fuzz tests ────────────────

    function testFuzz_buySellRoundTrip(uint256 usdcAmount) public {
        // Bound to reasonable range (0.01 USDC to 100k USDC)
        usdcAmount = bound(usdcAmount, 10_000, 100_000 * ONE_USDC);

        vm.prank(alice);
        uint256 tokens = curve.buy(usdcAmount);
        assertGt(tokens, 0);

        vm.prank(alice);
        uint256 returned = curve.sell(tokens);

        // Should get back <= input (rounding loss)
        assertLe(returned, usdcAmount);
        // Loss should be bounded
        assertGt(returned, (usdcAmount * 95) / 100);
    }

    function testFuzz_buyIncreasesPrice(uint256 usdcAmount) public {
        usdcAmount = bound(usdcAmount, ONE_USDC, 10_000 * ONE_USDC);

        uint256 priceBefore = curve.getPrice();

        vm.prank(alice);
        curve.buy(usdcAmount);

        uint256 priceAfter = curve.getPrice();
        assertGt(priceAfter, priceBefore);
    }

    function testFuzz_sellDecreasesPrice(uint256 usdcAmount) public {
        usdcAmount = bound(usdcAmount, ONE_USDC, 10_000 * ONE_USDC);

        vm.prank(alice);
        uint256 tokens = curve.buy(usdcAmount);

        uint256 priceBefore = curve.getPrice();

        vm.prank(alice);
        curve.sell(tokens);

        uint256 priceAfter = curve.getPrice();
        assertLt(priceAfter, priceBefore);
    }
}
