# ipfs_mock.py
import uuid

def upload_to_ipfs( str) -> str:
    """模拟 IPFS 上传"""
    return f"QmTrackless_{uuid.uuid4().hex[:20]}"

def fetch_from_ipfs(cid: str) -> str:
    """模拟 IPFS 下载"""
    return "U2FsdGVkX1+...[mock encrypted GPS data]"