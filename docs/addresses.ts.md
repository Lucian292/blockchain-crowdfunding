# addresses.ts - Explicație Simplă

## Ce face acest fișier?

Acest fișier stochează **adresele contractelor deploy-ate** pe blockchain. Este folosit de frontend pentru a ști unde să găsească fiecare contract.

## Cum funcționează?

Conține un obiect cu adresele tuturor contractelor:
- `token`: Adresa contractului CustomERC20Token
- `sponsor`: Adresa contractului SponsorFunding
- `distribute`: Adresa contractului DistributeFunding
- `crowd`: Adresa unei campanii demo (opțional)
- `factory`: Adresa contractului CampaignFactory

## De ce e important?

Fără acest fișier, frontend-ul nu ar ști unde sunt contractele. Este ca un "director telefonic" pentru contracte.

## Actualizare automată:

Scriptul `deploy.ts` actualizează automat acest fișier după fiecare deploy. Nu trebuie să-l modifici manual (decât dacă deploy-ezi manual contractele).

## Exemplu:

```typescript
import { ADDRESSES } from "./contracts/addresses";

// Folosește adresa tokenului
const token = new ethers.Contract(ADDRESSES.token, tokenAbi, signer);
```

## Notă importantă:

Dacă redeploy-ezi contractele, acest fișier se actualizează automat. Dacă folosești contracte existente, trebuie să actualizezi manual adresele.
