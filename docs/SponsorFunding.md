# SponsorFunding.sol - Explicație Simplă

## Ce face acest contract?

Acest contract gestionează **sponsorizarea** campaniilor. Este ca un "portofel special" care poate adăuga tokeni suplimentari la o campanie care a atins deja goal-ul.

## Cum funcționează?

### 1. Cumpărarea tokenilor pentru sponsorizare (`buySponsorTokens`):
- **Cine poate**: Oricine! (nu doar owner-ul)
- **Cum**: Trimite ETH și cumpără tokeni care sunt depozitați în contract
- **De ce**: Aceste tokeni vor fi folosiți mai târziu pentru a sponsoriza campaniile

### 2. Sponsorizarea unei campanii (`sponsor`):
- **Cine apelează**: Doar contractul `CrowdFunding` (când owner-ul cere sponsorizarea)
- **Cum funcționează**:
  - Calculează câți tokeni sunt necesari (ex: 10% din suma strânsă)
  - Verifică dacă contractul are suficienți tokeni
  - Dacă da, transferă tokenii către campanie
  - Dacă nu, returnează 0 (campania continuă fără sponsorizare)

## Exemplu simplu:

- Campanie a strâns: 1000 tokeni
- SponsorFunding are: 150 tokeni
- Procent sponsorizare: 10%
- Necesar: 100 tokeni (10% din 1000)
- Rezultat: SponsorFunding transferă 100 tokeni → campanie are acum 1100 tokeni

## De ce e important?

Permite campaniilor să primească fonduri suplimentare după ce au atins goal-ul, făcându-le mai puternice și mai atractive.

## Notă importantă:

SponsorFunding este un **portofel independent** - nu are un owner care să-l controleze. Oricine poate cumpăra tokeni pentru sponsorizare, dar doar campaniile pot primi aceste tokeni.
