# TokenPage.tsx - Explicație Simplă

## Ce face acest fișier?

Acesta este un **component React separat** care gestionează operațiunile cu tokeni. Este o pagină dedicată pentru cumpărarea de tokeni.

## Cum funcționează?

### 1. **Afișarea informațiilor**:
- Simbolul tokenului (ex: "EDU")
- Balanța utilizatorului
- Prețul per token în ETH

### 2. **Cumpărarea tokenilor** (`buyTokens`):
- Utilizatorul introduce cantitatea dorită
- Se calculează costul în ETH (cantitate × preț)
- Se trimite tranzacția către contractul `CustomERC20Token`
- După confirmare, se actualizează balanța

## De ce e separat?

Este o pagină separată pentru a menține codul organizat. Când utilizatorul vrea să cumpere tokeni, navighează la această pagină dedicată.

## Flux simplu:

1. Utilizator intră pe pagina "Token"
2. Vezi balanța și prețul
3. Introduci cantitatea dorită
4. Apeși "Buy Tokens"
5. Confirmi tranzacția în MetaMask
6. Primești tokenii în portofel

## Notă:

Această pagină este accesibilă din meniul principal al aplicației și este independentă de campanii.
