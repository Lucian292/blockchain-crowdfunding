# IToken.sol - Explicație Simplă

## Ce face acest fișier?

Acesta este o **interfață** - nu este un contract complet, ci doar o "schemă" care definește ce funcții trebuie să aibă un token.

## Cum funcționează?

O interfață este ca o "listă de cerințe". Spune: "Orice token care vrea să fie compatibil trebuie să aibă aceste funcții":

1. **transfer(to, amount)**: Transferă tokeni către o adresă
2. **transferFrom(from, to, amount)**: Transferă tokeni de la o adresă la alta (folosit când ai dat approve)
3. **balanceOf(account)**: Verifică câți tokeni are o adresă

## De ce e important?

Alte contracte (cum ar fi `CrowdFunding`) folosesc această interfață pentru a ști cum să interacționeze cu orice token compatibil, fără să știe exact ce tip de token este.

## Analogie:

E ca și cum ai spune: "Orice mașină trebuie să aibă volan, pedale și motor". Nu specifici marca, dar știi că toate mașinile au aceste lucruri.
