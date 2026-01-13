# CampaignFactory.sol - Explicație Simplă

## Ce face acest contract?

Acest contract este o **fabrică de campanii**. Permite oricui să creeze campanii noi de crowdfunding fără să fie nevoie să deploy-eze manual fiecare contract.

## Cum funcționează?

1. **Crearea unei campanii** (`createCampaign`):
   - Oricine poate apela această funcție
   - Trebuie să furnizeze:
     - Adresa tokenului (ex: CustomERC20Token)
     - Goal-ul campaniei (câți tokeni vrea să strângă)
     - Adresele contractelor SponsorFunding și DistributeFunding
   - Contractul creează automat un nou contract `CrowdFunding`
   - Persoana care apelează devine automat owner-ul noii campanii
   - Noua campanie este adăugată într-o listă

2. **Urmărirea campaniilor**:
   - `campaigns[]`: Listă cu toate adresele campaniilor create
   - `isCampaign(address)`: Verifică dacă o adresă este o campanie validă
   - `getAllCampaigns()`: Returnează toate campaniile

## De ce e important?

Fără factory, ar trebui să deploy-ezi manual fiecare campanie, ceea ce e complicat și costisitor. Cu factory, oricine poate crea o campanie cu o singură tranzacție.

## Exemplu simplu:

```
Utilizator: "Vreau o campanie cu goal 1000 tokeni"
Factory: "OK, am creat campania la adresa 0x123..."
Utilizator: "Perfect, acum sunt owner-ul campaniei!"
```

## Analogie:

E ca o mașină de făcut pizza: pui ingredientele, apasă butonul, și primești o pizza nouă. Aici pui parametrii, apelezi funcția, și primești o campanie nouă!
