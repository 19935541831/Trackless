<!-- Bilingual README: English-->
# Trackless——A Decentralized Device Discovery and Item Tracking Network Powered by BluetoothNFC Proximity Communication

### Project Overview

Trackless is a full-stack project that demonstrates a blockchain-backed tracking system. It contains three main parts:

- `trackless-backend` — Python backend (API, database mock, IPFS mock)
- `trackless-contracts` — Solidity smart contracts and Hardhat setup
- `trackless-frontend` — React frontend (Vite)

This README covers installation, testing, running, and usage for local development.

### Architecture

- Smart contracts manage token/asset logic and are developed with Hardhat.
- Backend provides API and mocked IPFS/database for local testing.
- Frontend is a React app that interacts with contracts and the backend.

### Project & Features

- On-chain core: `TracklessCore.sol` implements the contract-level logic for registering trackers, ownership management, and verification. Contracts emit events used by the backend and frontend to reflect on-chain state.
- Token integration: `MockTRACK.sol` is provided as a test ERC-20 token used in demos and tests to simulate token interactions and payments.
- Register trackers: users can register a tracker (an asset identifier) on-chain; metadata (images, descriptions, timestamps) is stored off-chain and referenced by the contract (IPFS CID in production; `ipfs_mock.py` used locally).
- Scan & update: the app supports scanning a tracker ID or QR code to submit location/status updates and record proofs on-chain or via the backend for demo flows.
- Lost & found workflow: users can mark trackers as lost, claim ownership, or report found items — the frontend routes `lost.$eid.tsx`, `find.$eid.tsx`, and `register.tsx` implement these flows.
- Map visualization: `ClientMap.tsx` shows tracker locations and status on a map for easy browsing and recovery.
- Wallet connect: `WalletConnectButton.tsx` and the `WalletContext` handle wallet connection in the browser (local Hardhat accounts or external wallets).
- Backend bridging: `trackless-backend` serves as a bridge for off-chain metadata, implements `ipfs_mock.py` and `database.py`, and exposes APIs used by the frontend for listing and searching trackers.
- Tests & tooling: Hardhat tests live in `trackless-contracts/test/` and Python test utilities exist in `trackless-backend/test.py` to validate backend flows.


### Requirements

- Node.js (>=16 recommended) and npm
- Python 3.8+ and `pip`
- Git

---

### Quick Setup (PowerShell)

1) Clone the repo:

```powershell
git clone <your-repo-url> final
cd final
```

2) Backend (Python)

```powershell
cd trackless-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Run backend
uvicorn main:app --reload
```

3) Contracts (Hardhat)

```powershell
cd trackless-contracts
npm install
# Run local node (optional)
npx hardhat node
# In another terminal deploy or run tests
npx hardhat run deploy.js --network localhost
npx hardhat test
```

4) Frontend

```powershell
cd trackless-frontend
npm install
npm run dev
# open the dev URL shown by Vite (usually http://localhost:5173)
```
> **Note:** The browser needs to download the MetaMask wallet extension and properly configure the local Hardhat network.

### Testing

- Contracts: run Hardhat tests

```powershell
cd trackless-contracts
npx hardhat test
```

- Frontend: run the dev server and use the app; unit tests (if present) via `npm test`.


### Notes

- Contract artifacts and deployments are in `trackless-contracts/artifacts` and `trackless-contracts/deployments`.
- The backend includes `ipfs_mock.py` and `database.py` for local testing without external services.

---


## License

Please check repository root for license information. If none exists, add one before distribution.
