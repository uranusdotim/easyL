# easyL

A tool to improve launchpad token liquidity on Base. easyL pools USDC from depositors into a vault and deploys it as active liquidity on bonding-curve token launches, earning trading returns that flow back to all depositors through an appreciating share price.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  VaultStats · DepositForm · RedeemForm · OwnerPanel │
│                 BondingCurvePanel                    │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
    ┌──────▼──────┐          ┌────────▼────────┐
    │  EasyLVault │          │  BondingCurve   │
    │   (EASYL)   │◄─USDC──►│    (RSIM)       │
    │  6 decimals │          │  18 decimals    │
    └─────────────┘          └─────────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
              ┌───────▼───────┐
              │  USDC (Circle)│
              │  Base Sepolia │
              └───────────────┘
```

## Deployed Contracts (Base Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [BaseScan](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| EasyLVault | `0xd2Ae9bE53118493E6a7c1114ac88B5801cc89a46` | [BaseScan](https://sepolia.basescan.org/address/0xd2Ae9bE53118493E6a7c1114ac88B5801cc89a46) |
| BondingCurve | `0x553949E3F24299c981B982d37efe9D5fC6aD650D` | [BaseScan](https://sepolia.basescan.org/address/0x553949E3F24299c981B982d37efe9D5fC6aD650D) |

## Project Structure

```
easyL/
├── contracts/                    Foundry (Solidity ^0.8.24)
│   ├── src/
│   │   ├── EasyLVault.sol        ERC20 vault with owner market making
│   │   └── BondingCurve.sol      Linear bonding curve token launcher
│   ├── test/
│   │   ├── EasyLVault.t.sol      44 tests (incl. fuzz)
│   │   └── BondingCurve.t.sol    28 tests (incl. fuzz)
│   └── script/
│       ├── DeploySepolia.s.sol    Vault deployment
│       └── DeployBondingCurve.s.sol  Curve deployment
└── frontend/                     React + Vite + TypeScript
    └── src/
        ├── App.tsx               Main app layout
        ├── constants.ts          Contract addresses
        ├── abi.ts                Contract ABIs
        ├── config.ts             Wagmi + RainbowKit setup
        ├── hooks/
        │   ├── useVaultStats.ts  Vault state reads
        │   ├── useUserPosition.ts User balance reads
        │   ├── useDeposit.ts     Deposit + approve flow
        │   ├── useRedeem.ts      Redeem flow
        │   └── useBondingCurve.ts Curve state reads
        └── components/
            ├── VaultStats.tsx    TVL, share price, liquidity
            ├── UserPosition.tsx  User balances
            ├── DepositForm.tsx   Deposit USDC into vault
            ├── RedeemForm.tsx    Redeem EASYL for USDC
            ├── OwnerPanel.tsx    Deploy/return funds, report PnL
            ├── BondingCurvePanel.tsx  Buy/sell RSIM tokens
            └── TransactionStatus.tsx  Reusable tx feedback
```

## Simulated Market Making Flow

1. **Deposit** — Users deposit USDC into the vault, receive EASYL shares
2. **Deploy Funds** — Vault owner withdraws USDC from vault for trading
3. **Buy on Curve** — Owner buys RSIM tokens on the bonding curve with USDC
4. **Price Movement** — Other users buy RSIM, driving the price up
5. **Sell on Curve** — Owner sells RSIM for more USDC than they paid
6. **Return Funds** — Owner returns USDC to the vault
7. **Report PnL** — Owner reports the profit, increasing share price for all depositors

## Smart Contracts

### EasyLVault

ERC20 vault (EASYL token, 6 decimals) that accepts USDC deposits and issues proportional shares. The owner can deploy funds for market making and report profits/losses that adjust the share price.

Key features:
- ERC4626-inspired share accounting with `convertToShares`/`convertToAssets`
- Virtual offset (1e3) prevents ERC4626 inflation attacks
- Owner-only fund management: `deployFunds`, `returnFunds`, `reportPnL`

### BondingCurve

Linear bonding curve that mints RSIM tokens (18 decimals) when users send USDC. The price increases with supply: `price = 100 + 1 * totalSupply`.

Key features:
- `buy(usdcAmount)` — Solves the quadratic formula to calculate exact tokens for USDC input
- `sell(tokenAmount)` — Calculates USDC return from the integral of the price curve
- Uses OpenZeppelin `Math.mulDiv` and `Math.sqrt` for safe arithmetic

## Development

### Contracts

```shell
cd contracts
forge build       # Compile
forge test -vvv   # Run all 72 tests
```

### Frontend

```shell
cd frontend
npm install
npm run dev       # Dev server at localhost:5173
npm run build     # Production build
```

### Deploy

```shell
cd contracts

# Deploy vault
PRIVATE_KEY=<key> forge script script/DeploySepolia.s.sol:DeploySepoliaScript \
  --rpc-url https://sepolia.base.org --broadcast

# Deploy bonding curve
PRIVATE_KEY=<key> forge script script/DeployBondingCurve.s.sol:DeployBondingCurveScript \
  --rpc-url https://sepolia.base.org --broadcast
```

After deployment, update `BONDING_CURVE_ADDRESS` in `frontend/src/constants.ts`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin, Foundry |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Web3 | Wagmi v2, Viem v2, RainbowKit |
| Network | Base Sepolia (Chain ID: 84532) |
