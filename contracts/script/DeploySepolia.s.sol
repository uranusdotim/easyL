// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {EasyLVault} from "../src/EasyLVault.sol";

contract DeploySepoliaScript is Script {
    // Official Base Sepolia USDC (Circle)
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer:", deployer);
        console2.log("USDC:", BASE_SEPOLIA_USDC);

        vm.startBroadcast(deployerPrivateKey);

        EasyLVault vault = new EasyLVault(BASE_SEPOLIA_USDC, deployer);

        vm.stopBroadcast();

        console2.log("EasyLVault deployed to:", address(vault));
    }
}
