# Blockchain Crowdfunding (ERC-20) — Hardhat 3 (TypeScript)

Proiect pentru tema: colectare fonduri in token ERC-20 de la mai multi contribuitori, sponsorizare procentuala si distributie catre beneficiari.

## Features

- **Multiple Campaign Support**: Create and manage multiple independent crowdfunding campaigns
- **Campaign Factory**: Deploy new campaigns via factory contract
- **Token Operations**: Buy tokens and manage approvals
- **Campaign Contributions**: Contribute, withdraw, and track progress
- **Owner Actions**: Request sponsorship, transfer funds, manage beneficiaries
- **Beneficiary Claims**: Claim distributed funds

## Documentation

- **[Multiple Campaigns Guide](./MULTIPLE_CAMPAIGNS.md)**: Comprehensive documentation on how the multiple campaign system works, including architecture, code structure, and usage examples.

## Cerinte
- Node.js + npm
- Git (optional)
- Windows / Linux / macOS (merge pe toate)

## Instalare
```bash
npm install
```

## Useful commands
- Start Hardhat on the local network:
    npx hardhat run scripts/deploy.ts --network localhost

- Start Hardhat node:
    npx hardhat node

- Start Dapp
    cd dapp && npm run dev