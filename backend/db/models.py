from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, index=True)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    tags = Column(String, index=True, nullable=True)
    summary = Column(Text, nullable=True)
    file_path = Column(String)
    file_size = Column(Integer, nullable=True) # size in bytes

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    chunk_text = Column(Text)
    chunk_index = Column(Integer)

    document = relationship("Document", back_populates="chunks")
