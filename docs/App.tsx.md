# App.tsx - Explicație Simplă

## Ce face acest fișier?

Acesta este **fișierul principal** al aplicației web (frontend). Gestionează toată interacțiunea dintre utilizator și contractele blockchain.

## Cum funcționează?

### 1. **Gestionarea stării (State Management)**:
- Păstrează informații despre:
  - Contul utilizatorului conectat (MetaMask)
  - Lista de campanii
  - Campania selectată/vizualizată
  - Balanțe (ETH, tokeni)
  - Starea campaniei (nefinantat, prefinantat, finantat)

### 2. **Funcții principale**:

#### **Conexiune la wallet**:
- `connectWallet()`: Conectează MetaMask și obține adresa utilizatorului

#### **Gestionarea campaniilor**:
- `addCampaign()`: Adaugă o campanie existentă la listă
- `removeCampaign()`: Șterge o campanie din listă (doar owner)
- `createCampaignViaFactory()`: Creează o campanie nouă folosind factory-ul
- `viewCampaign()` / `closeCampaignView()`: Afișează/ascunde detaliile unei campanii

#### **Operații cu tokeni**:
- `approve()`: Dă permisiune campaniei să folosească tokenii tăi
- `contribute()`: Contribuie cu tokeni la campanie
- `withdraw()`: Retrage contribuția (doar dacă campania e nefinantat)

#### **Acțiuni pentru owner**:
- `buySponsorTokens()`: Cumpără tokeni pentru sponsorizare
- `requestSponsorship()`: Cere sponsorizare pentru campanie
- `transferToDistribute()`: Transferă fondurile către distribuție
- `addBeneficiary()`: Adaugă beneficiari pentru campanie

#### **Acțiuni pentru beneficiari**:
- `claim()`: Beneficiarii pot face claim la partea lor de fonduri

### 3. **Actualizarea datelor**:
- `refreshAll()`: Reîncarcă toate datele de pe blockchain
- Se apelează automat când:
  - Se conectează wallet-ul
  - Se schimbă campania selectată
  - Se finalizează o tranzacție

## Structura UI:

1. **Lista de campanii**: Dropdown cu toate campaniile disponibile
2. **Buton "View Campaign"**: Afișează detaliile unei campanii
3. **Secțiuni de acțiuni**:
   - **Campaign Actions**: Contribuie, retrage (pentru toți)
   - **Owner Actions**: Funcții disponibile doar pentru owner
   - **Beneficiary Actions**: Claim pentru beneficiari

## De ce e important?

Acest fișier este "puntea" dintre utilizator și blockchain. Fără el, utilizatorii nu ar putea interacționa cu contractele. Toate operațiunile complexe sunt simplificate într-o interfață prietenoasă.

## Notă importantă:

Fișierul este foarte mare (2000+ linii) pentru că gestionează toate funcționalitățile aplicației. Este organizat în secțiuni logice pentru ușurința înțelegerii.
