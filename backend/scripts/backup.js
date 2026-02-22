#!/usr/bin/env node
/**
 * PlaceEra — MongoDB JSON Backup Script
 * Usage:  node scripts/backup.js [outputDir]
 *
 * Exports the following collections to JSON files:
 *   users, topicmasteries, subjectmasteries, dailyconcepts,
 *   learningeventlogs, mocksessions, revisionqueues
 *
 * Output directory defaults to ./backups/YYYY-MM-DD_HH-MM-SS/
 *
 * Reads MONGODB_URI from .env (or ../../.env)
 */

const path = require('path');
const fs = require('fs');

// Load env vars
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');

const COLLECTIONS = [
    'users',
    'topicmasteries',
    'subjectmasteries',
    'dailyconcepts',
    'learningeventlogs',
    'mocksessions',
    'revisionqueues',
    'quizsubmissionlogs',
    'topics',
    'subjects'
];

async function runBackup() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('[Backup] ERROR: MONGODB_URI is not set in .env');
        process.exit(1);
    }

    // Determine output directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputBase = process.argv[2] || path.join(__dirname, '../backups');
    const outputDir = path.join(outputBase, `backup_${timestamp}`);
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`[Backup] Connecting to MongoDB…`);
    await mongoose.connect(uri);
    console.log(`[Backup] Connected. Writing to: ${outputDir}`);

    const db = mongoose.connection.db;
    const results = { timestamp, collections: [] };

    for (const collName of COLLECTIONS) {
        try {
            const coll = db.collection(collName);
            const docs = await coll.find({}).toArray();

            const outFile = path.join(outputDir, `${collName}.json`);
            fs.writeFileSync(outFile, JSON.stringify(docs, null, 2), 'utf8');
            console.log(`  ✓ ${collName}: ${docs.length} documents → ${collName}.json`);
            results.collections.push({ collection: collName, count: docs.length, file: `${collName}.json` });
        } catch (err) {
            console.warn(`  ⚠ ${collName}: skipped (${err.message})`);
            results.collections.push({ collection: collName, count: 0, error: err.message });
        }
    }

    // Write manifest
    const manifest = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifest, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n[Backup] ✅ Backup complete. Manifest: ${manifest}`);

    await mongoose.disconnect();
    process.exit(0);
}

runBackup().catch(err => {
    console.error('[Backup] Fatal error:', err.message);
    mongoose.disconnect();
    process.exit(1);
});
