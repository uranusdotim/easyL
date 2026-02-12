// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {EasyLVault} from "../src/EasyLVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock USDC for testnet deployments
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DeployTestnetScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock USDC
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed to:", address(usdc));

        // Mint 1M USDC to deployer for testing
        usdc.mint(deployer, 1_000_000e6);
        console2.log("Minted 1,000,000 USDC to deployer");

        // Deploy vault
        EasyLVault vault = new EasyLVault(address(usdc), deployer);
        console2.log("EasyLVault deployed to:", address(vault));

        // Approve vault to spend deployer's USDC
        usdc.approve(address(vault), type(uint256).max);
        console2.log("Approved vault for USDC spending");

        vm.stopBroadcast();
    }
}
