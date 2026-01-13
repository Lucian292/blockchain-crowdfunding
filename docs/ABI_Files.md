# Fișierele ABI - Explicație Simplă

## Ce sunt ABI-urile?

ABI (Application Binary Interface) sunt **"interfețe"** care descriu ce funcții are un contract și cum să le apelezi. Sunt necesare pentru ca frontend-ul să știe cum să comunice cu contractele.

## Fișierele ABI din proiect:

### 1. **tokenAbi.ts**
- Descrie funcțiile contractului `CustomERC20Token`
- Funcții: `buyTokens()`, `balanceOf()`, `approve()`, etc.

### 2. **crowdAbi.ts**
- Descrie funcțiile contractului `CrowdFunding`
- Funcții: `contribute()`, `withdraw()`, `requestSponsorship()`, etc.

### 3. **sponsorAbi.ts**
- Descrie funcțiile contractului `SponsorFunding`
- Funcții: `buySponsorTokens()`, `sponsor()`, etc.

### 4. **distributeAbi.ts**
- Descrie funcțiile contractului `DistributeFunding`
- Funcții: `addBeneficiaryForCampaign()`, `claim()`, etc.

### 5. **factoryAbi.ts**
- Descrie funcțiile contractului `CampaignFactory`
- Funcții: `createCampaign()`, `getAllCampaigns()`, etc.

### 6. **distAbi.ts** (vechi, poate fi eliminat)
- Versiune veche a `distributeAbi.ts`

## Cum funcționează?

Când frontend-ul vrea să apeleze o funcție dintr-un contract:

```typescript
// 1. Importă ABI-ul
import { tokenAbi } from "./contracts/tokenAbi";

// 2. Creează o instanță a contractului
const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);

// 3. Apelează funcția
await token.buyTokens(amount);
```

## De ce sunt importante?

Fără ABI-uri, frontend-ul nu ar ști:
- Ce funcții are contractul
- Ce parametri necesită fiecare funcție
- Ce returnează fiecare funcție

## Notă:

ABI-urile trebuie să fie sincronizate cu contractele. Dacă modifici un contract, trebuie să actualizezi și ABI-ul corespunzător.
