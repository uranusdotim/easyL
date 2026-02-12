# easyL Contracts

Smart contracts for the easyL vault and bonding curve simulation on Base Sepolia.

## Contracts

### EasyLVault (`src/EasyLVault.sol`)

An ERC20 vault where users deposit USDC and receive EASYL receipt tokens. The vault owner deploys USDC for market making; profits/losses adjust the share price for all depositors.

- **Token:** easyL Share (EASYL), 6 decimals
- **Underlying:** USDC (Circle)
- **Pattern:** ERC4626-inspired vault with owner-controlled market making
- **Security:** ReentrancyGuard, SafeERC20, virtual offset (1e3) for inflation attack protection

**User functions:**
- `deposit(assets, receiver)` — Deposit USDC, receive EASYL shares
- `redeem(shares, receiver)` — Burn EASYL, receive proportional USDC

**Owner functions:**
- `deployFunds(amount)` — Withdraw USDC from vault for market making
- `returnFunds(amount)` — Return USDC to vault from market making
- `reportPnL(amount)` — Report profit (positive) or loss (negative), adjusting share price

### BondingCurve (`src/BondingCurve.sol`)

A pump.fun-style token launcher with a linear bonding curve. Used for simulating market making on testnet (since robinpump.fun doesn't work on testnets).

- **Token:** RobinPump Sim (RSIM), 18 decimals
- **Reserve currency:** USDC
- **Pricing:** Linear bonding curve: `price(s) = BASE_PRICE + SLOPE * s`
  - `BASE_PRICE = 100` (0.0001 USDC in 6-decimal terms)
  - `SLOPE = 1` (price increase per token unit)
- **Security:** ReentrancyGuard, SafeERC20

**Functions:**
- `buy(usdcAmount)` — Send USDC, receive tokens (amount calculated via quadratic formula)
- `sell(tokenAmount)` — Burn tokens, receive USDC (amount calculated from curve integral)
- `getPrice()` — Current marginal price based on totalSupply
- `getBuyCost(amount)` — USDC cost to buy a specific number of tokens
- `getSellReturn(amount)` — USDC received for selling a specific number of tokens

**Bonding curve math:**
- Cost to buy from supply s0 to s1: `BASE_PRICE * (s1 - s0) + SLOPE/2 * (s1^2 - s0^2)`
- Sell returns the inverse calculation
- Uses `Math.mulDiv` and `Math.sqrt` (OpenZeppelin) to avoid overflow

## Deployments (Base Sepolia)

| Contract | Address |
|----------|---------|
| USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| EasyLVault | `0xd2Ae9bE53118493E6a7c1114ac88B5801cc89a46` |
| BondingCurve | `0x553949E3F24299c981B982d37efe9D5fC6aD650D` |

**Chain:** Base Sepolia (Chain ID: 84532)
**Deployer:** `0xC0234af1628A89c2db694754f8966B774eac0fD5`

## Simulated Market Making Flow

1. Users deposit USDC into the vault via `deposit()` — receive EASYL shares
2. Vault owner calls `deployFunds()` — withdraws USDC from vault
3. Owner buys RSIM tokens on the bonding curve with that USDC
4. Other users buy RSIM — price goes up
5. Owner sells RSIM tokens for more USDC than they paid
6. Owner calls `returnFunds()` — returns USDC to vault
7. Owner calls `reportPnL()` with the profit — share price increases for all depositors

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Build

```shell
forge build
```

### Test

```shell
forge test -vvv
```

Test suite: 72 tests (44 vault + 28 bonding curve), including fuzz tests.

### Deploy

```shell
# Base Sepolia - EasyLVault
PRIVATE_KEY=<key> forge script script/DeploySepolia.s.sol:DeploySepoliaScript \
  --rpc-url https://sepolia.base.org --broadcast

# Base Sepolia - BondingCurve
PRIVATE_KEY=<key> forge script script/DeployBondingCurve.s.sol:DeployBondingCurveScript \
  --rpc-url https://sepolia.base.org --broadcast
```

### Verify on BaseScan

```shell
forge verify-contract <ADDRESS> BondingCurve \
  --chain base-sepolia --watch
```

## Dependencies

- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) — ERC20, SafeERC20, ReentrancyGuard, Ownable, Math
- [Foundry](https://github.com/foundry-rs/foundry) — Build, test, deploy
