const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const dns = require('dns');
const mongoose = require('mongoose');
const fs = require('fs');

// Configure reliable DNS servers for Atlas SRV resolution
if (typeof dns.setServers === 'function') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '9.9.9.9']);
  } catch (_) {}
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function dumpAllDatabases() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not defined in .env');
    process.exit(1);
  }

  console.log('========================================================================');
  console.log('📦 RUNNING FULL DATABASE EXPORT (ALL DATABASES & COLLECTIONS)');
  console.log('========================================================================\n');

  try {
    console.log('Connecting to MongoDB Atlas Cluster...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ Connected to MongoDB Atlas successfully.\n');

    const adminDb = mongoose.connection.client.db().admin();
    const dbListResult = await adminDb.listDatabases();
    const systemDbs = ['admin', 'local', 'config'];
    const activeDbs = dbListResult.databases.filter(d => !systemDbs.includes(d.name));

    console.log(`Discovered ${activeDbs.length} application databases to dump:`);
    activeDbs.forEach(d => console.log(` - ${d.name} (${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`));
    console.log('');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpsBaseDir = path.resolve(__dirname, 'dumps');
    const jsonCollectionsDir = path.join(dumpsBaseDir, 'json_collections');

    if (!fs.existsSync(dumpsBaseDir)) fs.mkdirSync(dumpsBaseDir, { recursive: true });
    if (!fs.existsSync(jsonCollectionsDir)) fs.mkdirSync(jsonCollectionsDir, { recursive: true });

    const clusterDump = {};
    const summary = [];

    for (const dbInfo of activeDbs) {
      const dbName = dbInfo.name;
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`📂 Processing Database: [${dbName}]`);
      console.log(`------------------------------------------------------------------------`);

      const db = mongoose.connection.client.db(dbName);
      const collections = await db.listCollections().toArray();
      clusterDump[dbName] = {};

      const dbJsonDir = path.join(jsonCollectionsDir, dbName);
      if (!fs.existsSync(dbJsonDir)) fs.mkdirSync(dbJsonDir, { recursive: true });

      for (const col of collections) {
        const colName = col.name;
        process.stdout.write(`   ↳ Exporting collection "${colName}"... `);

        const documents = await db.collection(colName).find({}).toArray();
        clusterDump[dbName][colName] = documents;

        // Write individual collection JSON
        const colFilePath = path.join(dbJsonDir, `${colName}.json`);
        fs.writeFileSync(colFilePath, JSON.stringify(documents, null, 2));

        console.log(`(${documents.length} docs)`);
        summary.push({ database: dbName, collection: colName, count: documents.length });
      }

      // Also write per-database consolidated JSON
      const dbJsonPath = path.join(dumpsBaseDir, `${dbName}_database_dump_${timestamp}.json`);
      fs.writeFileSync(dbJsonPath, JSON.stringify(clusterDump[dbName], null, 2));
      console.log(`   💾 Saved ${dbName} consolidated JSON to: ${path.basename(dbJsonPath)}`);
    }

    // Write Master all-in-one JSON dump
    const masterJsonPath = path.join(dumpsBaseDir, `all_databases_dump_${timestamp}.json`);
    console.log(`\nWriting master dump file for all databases...`);
    fs.writeFileSync(masterJsonPath, JSON.stringify(clusterDump, null, 2));

    console.log('\n========================================================================');
    console.log('🎉 DATABASE DUMP COMPLETED SUCCESSFULLY FOR ALL DATABASES!');
    console.log('========================================================================');
    console.log(`\n📁 Dump Location: ${dumpsBaseDir}`);
    console.log(`📄 Master All-in-One JSON: ${masterJsonPath}`);
    console.log(`📂 Individual Collections: ${jsonCollectionsDir}`);
    console.log('\nSummary:');
    activeDbs.forEach(d => {
      const dbEntries = summary.filter(s => s.database === d.name);
      const totalDocs = dbEntries.reduce((acc, curr) => acc + curr.count, 0);
      console.log(` • ${d.name}: ${dbEntries.length} collections, ${totalDocs} total records`);
    });

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error dumping databases:', err.message);
    process.exit(1);
  }
}

dumpAllDatabases();
