# models.py
from sqlalchemy import Column, Integer, String, Float, LargeBinary, Boolean
from database import Base

class Tracker(Base):
    __tablename__ = "trackers"
    eid = Column(LargeBinary, primary_key=True)
    owner_addr = Column(String, nullable=False)
    is_lost = Column(Boolean, default=False)

class EncryptedReport(Base):
    __tablename__ = "encrypted_reports"
    cid = Column(String, primary_key=True)
    encrypted_payload = Column(String, nullable=False)
    eid = Column(LargeBinary, nullable=False)
    owner_addr = Column(String, nullable=False)

class ReportMeta(Base):
    __tablename__ = "report_metas"
    id = Column(Integer, primary_key=True)
    eid = Column(LargeBinary, nullable=False)
    scanner_temp_addr = Column(String, nullable=False)
    ipfs_cid = Column(String, nullable=False)
    timestamp = Column(Integer, nullable=False)