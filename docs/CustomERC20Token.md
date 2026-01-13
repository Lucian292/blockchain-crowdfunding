# CustomERC20Token.sol - Explicație Simplă

## Ce face acest contract?

Acest contract creează un token ERC-20 (ca Ethereum, dar personalizat) care poate fi cumpărat cu ETH la un preț fix.

## Cum funcționează?

1. **La creare (constructor)**:
   - Se creează un nume și simbol pentru token (ex: "EduToken", "EDU")
   - Se creează o cantitate inițială de tokeni care sunt depozitate în contractul însuși (rezervă)
   - Se setează un preț fix în ETH pentru fiecare token

2. **Cumpărarea tokenilor (buyTokens)**:
   - Oricine poate trimite ETH către contract
   - Contractul verifică că ai trimis exact suma corectă (număr tokeni × preț)
   - Dacă totul e OK, contractul îți transferă tokenii din rezervă

3. **Funcții pentru owner**:
   - `setPricePerUnitWei`: Owner-ul poate schimba prețul tokenilor
   - `withdrawEther`: Owner-ul poate retrage ETH-ul colectat din contract

## Exemplu simplu:

- Preț: 0.001 ETH per token
- Vrei să cumperi 100 tokeni
- Trimiți 0.1 ETH (100 × 0.001)
- Primești 100 tokeni în portofelul tău

## De ce e important?

Toate campaniile de crowdfunding folosesc acest token pentru a strânge fonduri. Utilizatorii cumpără tokeni, apoi contribuie cu acești tokeni la campanii.
