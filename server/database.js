const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'inventory.db');
let db = new sqlite3.Database(dbPath);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function restoreDatabaseFile(buffer) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error("Error closing database connection for restore:", err);
      }
      try {
        fs.writeFileSync(dbPath, buffer);
        db = new sqlite3.Database(dbPath);
        console.log("Database reconnected successfully after restore overwrite.");
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Promised wrappers for sqlite3 methods
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize schema and seed data
async function initDatabase() {
  try {
    // 1. Create tables
    await dbRun(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        sku TEXT,
        quantity INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'Available',
        min_quantity INTEGER DEFAULT 0,
        category TEXT DEFAULT 'Uncategorized',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
        type TEXT CHECK(type IN ('CHECK_IN', 'CHECK_OUT', 'STOCK_ADJUST', 'PURCHASE', 'SALE')),
        quantity_change INTEGER NOT NULL,
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        user_name TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('Engineer', 'Sales', 'Purchasing', 'Admin')) NOT NULL,
        password_hash TEXT,
        salt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add password columns if they don't exist on pre-existing users tables
    try {
      await dbRun('ALTER TABLE users ADD COLUMN password_hash TEXT');
      await dbRun('ALTER TABLE users ADD COLUMN salt TEXT');
      console.log('Migrated users table with password fields.');
    } catch (e) {
      // Column might already exist
    }

    // Migration: Add category column to assets table if it doesn't exist
    try {
      await dbRun("ALTER TABLE assets ADD COLUMN category TEXT DEFAULT 'Uncategorized'");
      console.log("Migrated assets table with category field.");
    } catch (e) {
      // Column might already exist
    }

    // 2. Seed default Locations if table is empty
    const locationsCount = await dbGet('SELECT COUNT(*) as count FROM locations');
    if (locationsCount.count === 0) {
      const locations = [
        { name: "Josh's Garage", description: "Josh's main workshop and storage" },
        { name: "Dan's Garage", description: "Dan's electronics storage and assembly" },
        { name: "Kev's Garage", description: "Kev's mechanical tools and prototyping space" },
        { name: "Main Office", description: "HQ inventory storage" },
        { name: "Staging Area", description: "Temporary incoming shipment staging" }
      ];
      for (const loc of locations) {
        await dbRun('INSERT INTO locations (name, description) VALUES (?, ?)', [loc.name, loc.description]);
      }
      console.log('Seeded default locations.');
    }

    // 3. Seed default Users if table is empty
    const usersCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (usersCount.count === 0) {
      const users = [
        { name: 'Josh', role: 'Admin' },
        { name: 'Dan', role: 'Engineer' },
        { name: 'Kev', role: 'Engineer' },
        { name: 'Sarah', role: 'Sales' },
        { name: 'Mike', role: 'Purchasing' }
      ];
      for (const user of users) {
        const { salt, hash } = hashPassword(user.name.toLowerCase() + '123');
        await dbRun('INSERT INTO users (name, role, password_hash, salt) VALUES (?, ?, ?, ?)', [user.name, user.role, hash, salt]);
      }
      console.log('Seeded default users.');
    } else {
      // Update any existing users that don't have passwords yet
      const missingCreds = await dbAll('SELECT id, name FROM users WHERE password_hash IS NULL');
      for (const user of missingCreds) {
        const { salt, hash } = hashPassword(user.name.toLowerCase() + '123');
        await dbRun('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, user.id]);
      }
      if (missingCreds.length > 0) {
        console.log(`Set default passwords for ${missingCreds.length} existing users.`);
      }
    }

    // 4. Seed default Assets if table is empty
    const assetsCount = await dbGet('SELECT COUNT(*) as count FROM assets');
    if (assetsCount.count === 0) {
      const joshGarage = await dbGet("SELECT id FROM locations WHERE name = ?", ["Josh's Garage"]);
      const danGarage = await dbGet("SELECT id FROM locations WHERE name = ?", ["Dan's Garage"]);
      const kevGarage = await dbGet("SELECT id FROM locations WHERE name = ?", ["Kev's Garage"]);

      const assets = [
        {
          id: 'qr-pi4-8gb',
          name: 'Raspberry Pi 4 (8GB)',
          description: 'Single-board computer for smart home integrations and nodes',
          sku: 'RPI4-8GB',
          quantity: 12,
          unit: 'pcs',
          location_id: joshGarage ? joshGarage.id : null,
          status: 'Available',
          min_quantity: 3
        },
        {
          id: 'qr-soldering-iron',
          name: 'TS100 Digital Soldering Iron',
          description: 'Portable smart soldering iron with temp control',
          sku: 'TS100-IRON',
          quantity: 4,
          unit: 'pcs',
          location_id: danGarage ? danGarage.id : null,
          status: 'Available',
          min_quantity: 1
        },
        {
          id: 'qr-hex-screws',
          name: 'M3 Hex Socket Cap Screws Box',
          description: 'Assorted lengths box of black carbon steel M3 hex screws',
          sku: 'M3-HEX-BOX',
          quantity: 480,
          unit: 'pcs',
          location_id: kevGarage ? kevGarage.id : null,
          status: 'Available',
          min_quantity: 100
        }
      ];

      for (const asset of assets) {
        await dbRun(
          `INSERT INTO assets (id, name, description, sku, quantity, unit, location_id, status, min_quantity) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [asset.id, asset.name, asset.description, asset.sku, asset.quantity, asset.unit, asset.location_id, asset.status, asset.min_quantity]
        );

        // Log an initial transaction
        await dbRun(
          `INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes) 
           VALUES (?, 'CHECK_IN', ?, ?, 'System', 'Initial seed stock added')`,
          [asset.id, asset.quantity, asset.location_id]
        );
      }
      console.log('Seeded default assets.');
    }

    // 5. Seed default Categories if table is empty
    const categoriesCount = await dbGet('SELECT COUNT(*) as count FROM categories');
    if (categoriesCount.count === 0) {
      const defaultCategories = [
        { name: 'Cables', description: 'Power cords, network connections, patch leads, HDMI, etc.' },
        { name: 'Adapters', description: 'Signal converters and cable adapters' },
        { name: 'Fasteners', description: 'Screws, bolts, nuts, and washers' },
        { name: 'Hardware', description: 'Physical components and chassis' },
        { name: 'Uncategorized', description: 'Default category for new items' }
      ];
      for (const cat of defaultCategories) {
        await dbRun('INSERT INTO categories (name, description) VALUES (?, ?)', [cat.name, cat.description]);
      }
      console.log('Seeded default categories.');
    }

    // 6. Migrate existing distinct asset categories to global categories table
    try {
      const distinctAssetCats = await dbAll("SELECT DISTINCT category FROM assets WHERE category IS NOT NULL AND category != ''");
      for (const row of distinctAssetCats) {
        try {
          await dbRun('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)', [row.category, 'Migrated from asset inventory']);
        } catch (e) {
          // Ignore UNIQUE conflicts
        }
      }
      console.log('Completed distinct category migration from assets table.');
    } catch (e) {
      console.warn('Category migration warning:', e);
    }

    // 7. Migrate assets table to include serial_number and warranty_expiry columns
    try {
      await dbRun("ALTER TABLE assets ADD COLUMN serial_number TEXT");
      console.log("Added serial_number column to assets table.");
    } catch (e) {
      // Column might already exist
    }

    try {
      await dbRun("ALTER TABLE assets ADD COLUMN warranty_expiry TEXT");
      console.log("Added warranty_expiry column to assets table.");
    } catch (e) {
      // Column might already exist
    }

  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

module.exports = {
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  hashPassword,
  restoreDatabaseFile,
  db
};
