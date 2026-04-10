import { openDB } from 'idb'

const DB_NAME = 'SmartPDFManager'
const DB_VERSION = 1

/**
 * Open (or create) the IndexedDB database with all required object stores.
 */
function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Documents store — holds metadata + PDF blob
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true })
        docStore.createIndex('uploadDate', 'uploadDate')
        docStore.createIndex('tags', 'tags')
      }

      // Chunks store — holds text chunks + embedding vectors
      if (!db.objectStoreNames.contains('chunks')) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true })
        chunkStore.createIndex('documentId', 'documentId')
      }

      // Chat history store
      if (!db.objectStoreNames.contains('chatHistory')) {
        db.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
}

// ─── Document Operations ────────────────────────────────────────────

/**
 * Add a new document with its PDF blob.
 * @returns {number} the auto-generated id
 */
export async function addDocument({ fileName, fileSize, tags, summary, pdfBlob }) {
  const db = await getDB()
  const id = await db.add('documents', {
    fileName,
    fileSize,
    tags: tags || 'Others',
    summary: summary || '',
    uploadDate: new Date().toISOString(),
    pdfBlob,
  })
  return id
}

export async function getAllDocuments() {
  const db = await getDB()
  // Return all docs sorted by upload date descending, WITHOUT the heavy blob
  const all = await db.getAll('documents')
  return all
    .map(({ pdfBlob, ...meta }) => meta)
    .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
}

export async function getDocument(id) {
  const db = await getDB()
  return db.get('documents', id)
}

export async function getDocumentBlob(id) {
  const doc = await getDocument(id)
  return doc?.pdfBlob || null
}

export async function deleteDocument(id) {
  const db = await getDB()
  // Delete related chunks first
  const tx = db.transaction(['documents', 'chunks'], 'readwrite')
  const chunkStore = tx.objectStore('chunks')
  const chunkIndex = chunkStore.index('documentId')
  let cursor = await chunkIndex.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.objectStore('documents').delete(id)
  await tx.done
}

export async function deleteDocumentsByDateRange(startDate, endDate) {
  const db = await getDB()
  const all = await db.getAll('documents')
  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  let count = 0
  for (const doc of all) {
    const d = new Date(doc.uploadDate)
    if (d >= start && d <= end) {
      await deleteDocument(doc.id)
      count++
    }
  }
  return count
}

export async function updateDocument(id, updates) {
  const db = await getDB()
  const doc = await db.get('documents', id)
  if (!doc) return null
  const updated = { ...doc, ...updates }
  await db.put('documents', updated)
  return updated
}

export async function renameCategory(oldName, newName) {
  const db = await getDB()
  const all = await db.getAll('documents')
  let count = 0
  const tx = db.transaction('documents', 'readwrite')
  for (const doc of all) {
    if (doc.tags === oldName) {
      doc.tags = newName
      await tx.store.put(doc)
      count++
    }
  }
  await tx.done
  return count
}

// ─── Chunk Operations ───────────────────────────────────────────────

/**
 * Store chunks with their embedding vectors for a document.
 * @param {number} documentId
 * @param {Array<{chunkText: string, chunkIndex: number, embedding: number[]}>} chunks
 */
export async function addChunks(documentId, chunks) {
  const db = await getDB()
  const tx = db.transaction('chunks', 'readwrite')
  for (const chunk of chunks) {
    await tx.store.add({
      documentId,
      chunkText: chunk.chunkText,
      chunkIndex: chunk.chunkIndex,
      embedding: chunk.embedding, // stored as plain number[]
    })
  }
  await tx.done
}

export async function getChunksByDocId(documentId) {
  const db = await getDB()
  const index = db.transaction('chunks').store.index('documentId')
  return index.getAll(documentId)
}

export async function getAllChunks() {
  const db = await getDB()
  return db.getAll('chunks')
}

/**
 * Local cosine similarity search against all stored chunk embeddings.
 * @param {number[]} queryEmbedding — the query vector from /embed-query
 * @param {number} topK — how many results to return
 * @returns {Promise<Array<{score, chunkText, documentId}>>}
 */
export async function searchChunksLocally(queryEmbedding, topK = 5) {
  const allChunks = await getAllChunks()
  if (allChunks.length === 0) return []

  const scored = allChunks.map(chunk => {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding)
    return { score, chunkText: chunk.chunkText, documentId: chunk.documentId }
  })

  scored.sort((a, b) => b.score - a.score)

  // Attach document names
  const db = await getDB()
  const results = []
  for (const item of scored.slice(0, topK)) {
    if (item.score < 0.20) continue // threshold
    const doc = await db.get('documents', item.documentId)
    results.push({
      score: item.score,
      chunkText: item.chunkText,
      documentId: item.documentId,
      documentName: doc?.fileName || 'Unknown',
      tags: doc?.tags || '',
    })
  }
  return results
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Compute merge suggestions locally by comparing first-chunk embeddings.
 */
export async function computeMergeSuggestions(similarityThreshold = 0.55) {
  const docs = await getAllDocuments()
  if (docs.length < 2) return []

  const db = await getDB()
  const docsWithEmb = []

  for (const doc of docs) {
    const chunks = await getChunksByDocId(doc.id)
    if (chunks.length > 0) {
      docsWithEmb.push({ doc, embedding: chunks[0].embedding })
    }
  }

  if (docsWithEmb.length < 2) return []

  const suggestions = []
  for (let i = 0; i < docsWithEmb.length; i++) {
    for (let j = i + 1; j < docsWithEmb.length; j++) {
      const sim = cosineSimilarity(docsWithEmb[i].embedding, docsWithEmb[j].embedding)
      if (sim > similarityThreshold) {
        suggestions.push({
          doc1: { id: docsWithEmb[i].doc.id, file_name: docsWithEmb[i].doc.fileName },
          doc2: { id: docsWithEmb[j].doc.id, file_name: docsWithEmb[j].doc.fileName },
          similarity: sim,
        })
      }
    }
  }

  suggestions.sort((a, b) => b.similarity - a.similarity)
  return suggestions
}

// ─── Chat History ───────────────────────────────────────────────────

export async function addChatMessage({ role, content, evidence }) {
  const db = await getDB()
  return db.add('chatHistory', {
    role,
    content,
    evidence: evidence || null,
    timestamp: new Date().toISOString(),
  })
}

export async function getChatHistory() {
  const db = await getDB()
  return db.getAll('chatHistory')
}

export async function clearChatHistory() {
  const db = await getDB()
  await db.clear('chatHistory')
}
