# Documentație Proiect - Index

Această documentație explică simplu cum funcționează fiecare fișier important din proiect.

## 📁 Contracte Solidity

### Contracte principale:
- [CustomERC20Token.md](./CustomERC20Token.md) - Tokenul ERC-20 care poate fi cumpărat cu ETH
- [CrowdFunding.md](./CrowdFunding.md) - Contractul care gestionează campaniile de crowdfunding
- [CampaignFactory.md](./CampaignFactory.md) - Factory-ul care creează campanii noi
- [SponsorFunding.md](./SponsorFunding.md) - Contractul care gestionează sponsorizarea
- [DistributeFunding.md](./DistributeFunding.md) - Contractul care distribuie fondurile către beneficiari

### Interfețe:
- [IToken.md](./IToken.md) - Interfața care definește funcțiile unui token

## 🎨 Frontend (React/TypeScript)

### Componente principale:
- [App.tsx.md](./App.tsx.md) - Componenta principală care gestionează toată aplicația
- [TokenPage.tsx.md](./TokenPage.tsx.md) - Pagina dedicată pentru cumpărarea de tokeni
- [main.tsx.md](./main.tsx.md) - Punctul de intrare al aplicației React

### Configurație frontend:
- [addresses.ts.md](./addresses.ts.md) - Adresele contractelor deploy-ate
- [ABI_Files.md](./ABI_Files.md) - Explicație despre fișierele ABI

## 🔧 Scripturi

### Scripturi Hardhat:
- [deploy.ts.md](./deploy.ts.md) - Scriptul care deploy-ează toate contractele
- [createCampaign.ts.md](./createCampaign.ts.md) - Scriptul care creează campanii noi

### Configurație:
- [hardhat.config.ts.md](./hardhat.config.ts.md) - Configurația Hardhat

## 📖 Cum să folosești această documentație?

1. **Pentru a înțelege un contract**: Citește fișierul `.md` corespunzător din secțiunea "Contracte Solidity"
2. **Pentru a înțelege frontend-ul**: Citește fișierele din secțiunea "Frontend"
3. **Pentru a deploy-a sau testa**: Citește fișierele din secțiunea "Scripturi"

## 🎯 Structura proiectului:

```
blockchain-crowdfunding/
├── contracts/          # Contracte Solidity
├── dapp/src/          # Frontend React
├── scripts/           # Scripturi Hardhat
├── docs/              # Această documentație
└── hardhat.config.ts  # Configurație Hardhat
```

## 💡 Notă importantă:

Toate explicațiile sunt scrise într-un mod simplu și accesibil, fără presupunerea de cunoștințe avansate. Dacă ceva nu este clar, citește din nou sau verifică codul sursă pentru mai multe detalii.
