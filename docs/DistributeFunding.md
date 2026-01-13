# DistributeFunding.sol - Explicație Simplă

## Ce face acest contract?

Acest contract gestionează **distribuția fondurilor** către beneficiari după ce o campanie a fost finanțată. Este ca un "trezorier" care împarte banii proporțional.

## Cum funcționează?

### 1. Adăugarea beneficiarilor (`addBeneficiaryForCampaign`):
- **Cine poate**: Owner-ul campaniei SAU owner-ul contractului
- **Cum**: Specifică adresa beneficiarului și "greutatea" (weight) în basis points
  - Basis points: 10000 = 100%
  - Ex: 6000 = 60%, 3000 = 30%, 1000 = 10%
- **Regulă**: Suma tuturor greutăților nu poate depăși 10000 (100%)

### 2. Notificarea fondurilor primite (`notifyFundsReceived`):
- **Cine apelează**: Automat de către `CrowdFunding` când owner-ul transferă fondurile
- **Ce face**: Înregistrează că fondurile au fost primite și cât au fost

### 3. Claim-ul fondurilor (`claim`):
- **Cine poate**: Doar beneficiarii înregistrați
- **Cum**: Fiecare beneficiar apelează `claim(campaignAddress)`
- **Calcul**: Primește (totalReceived × weightBps) / 10000
- **Regulă**: Fiecare beneficiar poate face claim o singură dată per campanie

## Exemplu simplu:

Campanie cu 1000 tokeni distribuiți:
- Beneficiar A: 60% (6000 bps) → primește 600 tokeni
- Beneficiar B: 30% (3000 bps) → primește 300 tokeni
- Beneficiar C: 10% (1000 bps) → primește 100 tokeni
- Total: 1000 tokeni (100%)

## De ce e important?

Asigură o distribuție corectă și transparentă a fondurilor către toți beneficiarii, fără posibilitatea de fraudă sau manipulare.

## Notă importantă:

Fiecare campanie are **proprii beneficiari**. Beneficiarii adăugați pentru o campanie nu sunt vizibili pentru alte campanii. Acest lucru permite fiecărei campanii să aibă propriul set de beneficiari.
