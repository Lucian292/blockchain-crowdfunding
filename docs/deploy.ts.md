# deploy.ts - Explicație Simplă

## Ce face acest script?

Acest script **deploy-ează toate contractele** pe blockchain. Este primul pas în configurarea sistemului.

## Cum funcționează?

### 1. **Deploy-ul contractelor (în ordine)**:

1. **CustomERC20Token**:
   - Creează tokenul cu nume "EduToken", simbol "EDU"
   - 1,000,000 tokeni inițiali în contract
   - Preț: 0.001 ETH per token

2. **SponsorFunding**:
   - Se conectează la tokenul creat
   - Procent sponsorizare: 10%

3. **DistributeFunding**:
   - Se conectează la tokenul creat
   - Va gestiona distribuția fondurilor

4. **CrowdFunding** (campanie demo):
   - Goal: 1000 tokeni
   - Se conectează la toate celelalte contracte
   - Owner: persoana care face deploy-ul

5. **CampaignFactory**:
   - Permite crearea de campanii noi

### 2. **Actualizarea adreselor**:
- După deploy, scriptul scrie automat adresele contractelor în `dapp/src/contracts/addresses.ts`
- Astfel, frontend-ul știe automat unde să găsească contractele

## Cum se folosește?

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

## De ce e important?

Fără acest script, nu ai avea contractele deploy-ate și nu ai putea folosi aplicația. Este esențial pentru inițializarea sistemului.

## Notă importantă:

După fiecare redeploy, adresele contractelor se schimbă. Scriptul actualizează automat fișierul `addresses.ts` pentru a nu trebui să o faci manual.
