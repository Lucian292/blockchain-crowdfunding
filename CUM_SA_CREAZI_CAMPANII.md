# Cum să creezi campanii noi

## Pași pentru a crea campanii noi folosind MetaMask

### 1. Deploy contractele

Primul pas este să deploy-ezi toate contractele, inclusiv Factory-ul:

```bash
# Într-un terminal, pornește Hardhat node
npx hardhat node

# În alt terminal, deploy-ează contractele
npx hardhat run scripts/deploy.ts --network localhost
```

După deploy, vei vedea în consolă adresele tuturor contractelor, inclusiv Factory-ul:

```
Deployer: 0x...
Token: 0x5FbDB2315678afecb367f032d93F642f64180aa3
SponsorFunding: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
DistributeFunding: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
CrowdFunding: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
CampaignFactory: 0x...  <-- ACEASTA E ADRESA DE CARE AI NEVOIE!
```

### 2. Copiază adresa Factory-ului

Copiaza adresa `CampaignFactory` din output-ul comenzii de deploy.

### 3. Folosește adresa în aplicație

În aplicația web:

1. **Conectează-te cu MetaMask** - Click pe "Connect Wallet"
2. **Selectează rețeaua corectă** - Trebuie să fii pe `localhost:8545` (Hardhat local network)
3. **Găsește secțiunea "Add Campaign"**
4. **În câmpul "Factory contract address"**, lipește adresa Factory-ului pe care ai copiat-o
5. **În câmpul "Funding goal"**, introdu goal-ul pentru campanie (ex: `1000` pentru 1000 tokeni)
6. **Click pe "Create Campaign"**
7. **Confirmă tranzacția în MetaMask**

### 4. Adresele necesare

Pentru a crea o campanie nouă, ai nevoie de:

- ✅ **Factory Address**: Adresa contractului `CampaignFactory` (obținută după deploy)
- ✅ **Token Address**: Deja configurat în cod (`0x5FbDB2315678afecb367f032d93F642f64180aa3`)
- ✅ **Sponsor Address**: Deja configurat în cod (`0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`)
- ✅ **Distribute Address**: Deja configurat în cod (`0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`)

**Notă**: Token, Sponsor și Distribute sunt deja configurate în cod, deci nu trebuie să le introduci manual. Doar Factory Address trebuie introdus.

## Opțiune alternativă: Adaugă manual o campanie existentă

Dacă ai deja o campanie deploy-ată și vrei doar să o adaugi în listă:

1. **Găsește secțiunea "Add Campaign"**
2. **În câmpul "Campaign address"**, introdu adresa contractului de campanie
3. **Click pe "Add Campaign"**

Nu este nevoie de Factory pentru această metodă.

## Verificare

După ce ai creat o campanie:

1. Campania ar trebui să apară automat în lista de campanii
2. Poți selecta campania din dropdown-ul "Select Campaign"
3. Poți vedea detaliile campaniei (state, goal, total collected, etc.)
4. Poți contribui la campanie după ce faci approve pentru tokeni

## Troubleshooting

### "Invalid factory address"
- Verifică că ai copiat corect adresa (trebuie să înceapă cu `0x` și să aibă 42 de caractere)
- Asigură-te că ai deploy-at Factory-ul pe aceeași rețea pe care ești conectat în MetaMask

### "Transaction failed"
- Verifică că ai ETH suficient în cont pentru gas fees
- Verifică că goal-ul introdus este un număr valid (ex: `1000`, nu `"1000"`)

### "Campaign not appearing"
- Refresh-ează pagina
- Verifică că tranzacția a fost confirmată în MetaMask
- Verifică console-ul browser-ului pentru erori

## Exemplu complet

```
1. Deploy: npx hardhat run scripts/deploy.ts --network localhost
   Output: CampaignFactory: 0x1234567890123456789012345678901234567890

2. În aplicație:
   - Factory address: 0x1234567890123456789012345678901234567890
   - Funding goal: 2000
   - Click "Create Campaign"
   - Confirmă în MetaMask

3. Rezultat: Campanie nouă creată și adăugată în listă!
```
