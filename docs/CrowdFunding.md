# CrowdFunding.sol - Explicație Simplă

## Ce face acest contract?

Acest contract gestionează o **campanie de crowdfunding**. Permite oamenilor să contribuie cu tokeni pentru a ajunge la un obiectiv financiar.

## Cum funcționează?

Contractul are **3 stări** (ca un joc cu niveluri):

### 1. NEFINANTAT (nefinanțat)
- **Ce se poate face**: Oamenii pot contribui cu tokeni și pot retrage contribuțiile
- **Cum funcționează**:
  - Utilizatorii trebuie să dea "approve" la tokeni înainte
  - Apoi pot contribui cu `contribute(amount)`
  - Dacă nu mai vor, pot retrage cu `withdraw(amount)`
- **Când se schimbă**: Când suma strânsă ajunge la obiectiv (goal)

### 2. PREFINANTAT (pre-finanțat)
- **Ce se poate face**: Nimic! Contribuțiile și retragerile sunt blocate
- **De ce**: Goal-ul a fost atins, așteaptă sponsorizarea
- **Cum se schimbă**: Owner-ul campaniei apelează `requestSponsorship()`

### 3. FINANTAT (finanțat)
- **Ce se poate face**: Owner-ul poate transfera fondurile către distribuție
- **Cum se ajunge aici**: După ce se încearcă sponsorizarea (chiar dacă nu reușește)
- **Următorul pas**: Owner-ul apelează `transferToDistribute()` pentru a trimite tokenii către beneficiari

## Funcții importante:

- **contribute(amount)**: Contribuie cu tokeni la campanie
- **withdraw(amount)**: Retrage contribuția (doar în starea NEFINANTAT)
- **requestSponsorship()**: Owner-ul cere sponsorizare (doar în PREFINANTAT)
- **transferToDistribute()**: Owner-ul transferă fondurile către distribuție (doar în FINANTAT)

## Exemplu simplu:

1. Campanie cu goal: 1000 tokeni
2. Utilizatorii contribuie până ajung la 1000 → trece în PREFINANTAT
3. Owner cere sponsorizare → trece în FINANTAT
4. Owner transferă fondurile → beneficiarii pot face claim
