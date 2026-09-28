require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function dumpDatabase() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('Connected to Database successfully.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const dumpData = {};
    
    console.log(`Found ${collections.length} collections. Starting dump...`);

    for (const col of collections) {
      console.log(`Exporting: ${col.name}...`);
      const data = await db.collection(col.name).find({}).toArray();
      dumpData[col.name] = data;
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(__dirname, `database_dump_${dateStr}.json`);
    
    console.log('Writing data to file...');
    fs.writeFileSync(outputPath, JSON.stringify(dumpData, null, 2));
    
    console.log(`\n✅ Database successfully dumped!`);
    console.log(`📁 File saved at: ${outputPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error dumping database. Make sure your IP is whitelisted in MongoDB Atlas!');
    console.error(error.message);
    process.exit(1);
  }
}

dumpDatabase();
