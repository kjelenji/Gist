// memory.js — Google Cloud Firestore persistent memory for the Gist Mystery Architect
//
// SETUP (one-time):
//   1. npm install firebase-admin
//   2. Create a Google Cloud project at https://console.cloud.google.com
//   3. Enable Firestore: Firestore → Create Database (Native mode)
//   4. IAM & Admin → Service Accounts → Create → grant "Cloud Datastore User" role
//   5. Click the service account → Keys → Add Key → JSON
//   6. Save the downloaded file as `serviceAccount.json` in this project folder
//      OR set env var: GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
//
// Without credentials, memory silently falls back to in-memory-only mode
// (the game still works — AI just won't remember past mysteries between restarts).

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

let _db          = null;
let _initialized = false;

async function getDb() {
  if (_initialized) return _db;
  _initialized = true;
  try {
    // Dynamic import so the app still starts if firebase-admin isn't installed
    const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    const keyPath = path.join(__dirname, 'serviceAccount.json');
    if (existsSync(keyPath)) {
      const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
    } else {
      console.warn('[memory] No Google Cloud credentials found — Firestore disabled.');
      console.warn('[memory] Add serviceAccount.json or set GOOGLE_APPLICATION_CREDENTIALS to enable AI memory.');
      return null;
    }

    _db = getFirestore();
    console.log('[memory] ✓ Firestore connected — AI memory enabled');
    return _db;
  } catch (err) {
    if (err.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || err.message?.includes('Cannot find')) {
      console.warn('[memory] firebase-admin not installed. Run: npm install firebase-admin');
    } else {
      console.warn('[memory] Firestore init failed:', err.message);
    }
    return null;
  }
}

/**
 * Load the last 5 saved mysteries for memory context injection into new prompts.
 * Returns [] if Firestore is unavailable.
 */
export async function loadMemory() {
  const db = await getDb();
  if (!db) return [];
  try {
    const snapshot = await db.collection('mysteries')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.warn('[memory] loadMemory error:', err.message);
    return [];
  }
}

/**
 * Save a completed mystery so the AI can reference it in future sessions.
 * Silently fails if Firestore is unavailable.
 */
export async function saveMemory(levelData) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.collection('mysteries').add({
      theme:     levelData.theme    || '',
      story:     levelData.story    || '',
      objects:   (levelData.cards   || []).map(c => c.object_label || c.name || ''),
      riddles:   (levelData.riddles || []).map(r => r.text || ''),
      createdAt: new Date()
    });
    console.log('[memory] Saved mystery to Firestore:', levelData.theme);
  } catch (err) {
    console.warn('[memory] saveMemory error:', err.message);
  }
}
