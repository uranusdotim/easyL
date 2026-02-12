// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {EasyLVault} from "../src/EasyLVault.sol";

contract DeployScript is Script {
    // Base mainnet USDC
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer:", deployer);
        console2.log("USDC:", BASE_USDC);

        vm.startBroadcast(deployerPrivateKey);

        EasyLVault vault = new EasyLVault(BASE_USDC, deployer);

        vm.stopBroadcast();

        console2.log("EasyLVault deployed to:", address(vault));
    }
}
