# main.py
import os
import json
import uuid
from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from web3 import Web3
from dotenv import load_dotenv

from database import SessionLocal, engine, Base
from models import ReportMeta
from ipfs_mock import upload_to_ipfs, fetch_from_ipfs

# 加载环境变量
load_dotenv()

# 初始化数据库
Base.metadata.create_all(bind=engine)

# Web3 配置
WEB3_URL = os.getenv("WEB3_PROVIDER_URL", "http://127.0.0.1:8545")
w3 = Web3(Web3.HTTPProvider(WEB3_URL))
if not w3.is_connected():
    raise Exception(f"Cannot connect to Web3 provider at {WEB3_URL}")

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
OWNER_PRIVATE_KEY = os.getenv("OWNER_PRIVATE_KEY")
if not CONTRACT_ADDRESS or not OWNER_PRIVATE_KEY:
    raise Exception("Missing CONTRACT_ADDRESS or OWNER_PRIVATE_KEY in .env")

owner_account = w3.eth.account.from_key(OWNER_PRIVATE_KEY)
owner_address = owner_account.address

# 加载合约 ABI（建议使用编译后的 JSON）
ABI_PATH = "../trackless-contracts/artifacts/contracts/TracklessCore.sol/TracklessCore.json"
try:
    with open(ABI_PATH) as f:
        contract_abi = json.load(f)["abi"]
except Exception as e:
    raise Exception(f"Failed to load contract ABI: {e}")

contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)

# FastAPI 应用
app = FastAPI(title="Trackless Backend", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据库依赖
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------------
# API Endpoints (符合 Trackless 架构)
# ------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "web3_connected": w3.is_connected(),
        "contract": CONTRACT_ADDRESS
    }

@app.post("/api/ipfs/upload")
def upload_encrypted_report(payload: str = Body(..., embed=True)):
    """模拟 IPFS 上传（生产环境应使用真实 IPFS）"""
    if not isinstance(payload, str) or len(payload) < 20:
        raise HTTPException(status_code=400, detail="Invalid encrypted payload")
    
    cid = upload_to_ipfs(payload)  # 替换为真实 IPFS 客户端
    return {"cid": cid}

@app.post("/api/scan")
def submit_scan_report(
    eid: str = Body(...),
    ipfs_cid: str = Body(...),
    scanner_addr: str = Body(...),
    db: Session = Depends(get_db)
):
    """
    扫描者上报发现 -> 后端验证 -> 调用 submitReport（仅限可信中继）
    """
    print(f"[DEBUG] Received scan report:")
    print(f"  - eid: {eid}")
    print(f"  - scanner_addr: {scanner_addr}")
    print(f"  - ipfs_cid: {ipfs_cid}")
    
    # 1. 验证 EID (32 字节 hex)
    try:
        print(f"[DEBUG] Validating EID...")
        eid_bytes = bytes.fromhex(eid)
        assert len(eid_bytes) == 32
        print(f"[DEBUG] EID valid: {eid_bytes.hex()}")
    except Exception as e:
        print(f"[DEBUG] EID validation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid EID (64 hex chars): {str(e)}")

    # 2. 验证地址
    print(f"[DEBUG] Validating address...")
    if not w3.is_address(scanner_addr):
        raise HTTPException(status_code=400, detail="Invalid scanner address")
    print(f"[DEBUG] Address valid")

    # 3. 链上验证：是否注册 + 是否在丢失模式
    try:
        print(f"[DEBUG] Checking chain status...")
        owner = contract.functions.trackerToOwner(eid_bytes).call()
        print(f"[DEBUG] Owner address: {owner}")
        
        if owner == "0x0000000000000000000000000000000000000000":
            print(f"[DEBUG] Tracker not registered")
            raise HTTPException(status_code=400, detail="Tracker not registered")
        
        is_lost = contract.functions.isLost(eid_bytes).call()
        print(f"[DEBUG] Is lost mode: {is_lost}")
        
        if not is_lost:
            print(f"[DEBUG] Tracker not in lost mode")
            raise HTTPException(status_code=400, detail="Tracker not in lost mode")
        
        print(f"[DEBUG] Owner: {owner.lower()}, Scanner: {scanner_addr.lower()}")
        if owner.lower() == scanner_addr.lower():
            print(f"[DEBUG] Self-report detected")
            raise HTTPException(status_code=400, detail="Self-report not allowed")
            
        print(f"[DEBUG] Chain validation passed")
    except Exception as e:
        print(f"[DEBUG] Chain validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Chain validation error: {str(e)}")

    # 4. 保存元数据（防重复）
    print(f"[DEBUG] Checking for duplicate reports...")
    existing = db.query(ReportMeta).filter_by(eid=eid_bytes, scanner_temp_addr=scanner_addr).first()
    if existing:
        print(f"[DEBUG] Duplicate report found")
        raise HTTPException(status_code=400, detail="Already reported by this scanner")
    print(f"[DEBUG] No duplicates found")

    # 5. 保存到数据库
    print(f"[DEBUG] Saving to database...")
    meta = ReportMeta(
        eid=eid_bytes,
        scanner_temp_addr=scanner_addr,
        ipfs_cid=ipfs_cid,
        timestamp=int(w3.eth.get_block('latest')['timestamp'])
    )
    db.add(meta)
    db.commit()
    print(f"[DEBUG] Saved to database with ID: {meta.id}")

    # 6. 调用 submitReport（由中继/后端调用）
    try:
        print(f"[DEBUG] Building transaction...")
        nonce = w3.eth.get_transaction_count(owner_address)
        print(f"[DEBUG] Nonce: {nonce}")
        
        tx = contract.functions.submitReport(eid_bytes, scanner_addr, ipfs_cid).build_transaction({
            'chainId': 31337,
            'gas': 500000,
            'gasPrice': w3.to_wei('1', 'gwei'),
            'nonce': nonce,
        })
        
        print(f"[DEBUG] Signing transaction...")
        signed_tx = w3.eth.account.sign_transaction(tx, OWNER_PRIVATE_KEY)
        
        print(f"[DEBUG] Sending transaction...")
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"[DEBUG] Transaction sent: {tx_hash.hex()}")
        
    except Exception as e:
        print(f"[DEBUG] Transaction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

    return {
        "status": "success",
        "report_id": meta.id,
        "tx_hash": tx_hash.hex(),
        "ipfs_cid": ipfs_cid
    }

@app.get("/api/reports/{eid}")
def get_report_cids(eid: str, db: Session = Depends(get_db)):
    """返回某 EID 的所有报告（生产环境应验证物主身份）"""
    try:
        eid_bytes = bytes.fromhex(eid)
        assert len(eid_bytes) == 32
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid EID")

    reports = db.query(ReportMeta).filter(ReportMeta.eid == eid_bytes).all()
    return [{
        "ipfs_cid": r.ipfs_cid,
        "timestamp": r.timestamp,
        "scanner": r.scanner_temp_addr
    } for r in reports]

@app.get("/api/ipfs/{cid}")
def get_encrypted_report(cid: str):
    """返回加密的位置数据（仅物主持私钥可解密）"""
    encrypted_data = fetch_from_ipfs(cid)  # 生产环境：真实 IPFS
    return {
        "cid": cid,
        "encrypted_payload": encrypted_data,
        "note": "This payload is end-to-end encrypted. Only the tracker owner can decrypt it."
    }

# Note: 
# - 用户激活丢失模式（支付 Query Fee）由前端直接调用合约（非后端）
# - Bounty 由前端调用 sendBounty
# - 后端仅作为可信中继处理 submitReport（防作弊）