# createCampaign.ts - Explicație Simplă

## Ce face acest script?

Acest script creează o **campanie nouă** folosind `CampaignFactory`. Este util pentru testare sau pentru a crea campanii din linia de comandă.

## Cum funcționează?

1. **Obține adresele contractelor**:
   - Token, SponsorFunding, DistributeFunding
   - Factory (din variabila de mediu sau hardcodat)

2. **Creează campania**:
   - Goal: 1000 tokeni (configurabil)
   - Folosește al doilea signer (user) ca owner
   - Apelează `factory.createCampaign()`

3. **Verifică rezultatul**:
   - Extrage adresa campaniei din eveniment
   - Verifică că user-ul este într-adevăr owner
   - Afișează detaliile campaniei

## Cum se folosește?

```bash
npx hardhat run scripts/createCampaign.ts --network localhost
```

Sau cu factory custom:
```bash
FACTORY_ADDRESS=0x... npx hardhat run scripts/createCampaign.ts --network localhost
```

## De ce e util?

- **Testare**: Poți crea campanii rapid pentru a testa funcționalitățile
- **Debugging**: Poți verifica că ownership-ul este setat corect
- **Automatizare**: Poți integra în scripturi mai complexe

## Notă:

Scriptul folosește al doilea signer (user) pentru a crea campania, astfel încât deployer-ul să nu fie automat owner-ul tuturor campaniilor.
