const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { initDatabase, dbRun, dbGet, dbAll, hashPassword, restoreDatabaseFile } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Memory store for session tokens
const activeSessions = new Map();

function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Session Validation Middleware
app.use((req, res, next) => {
  const publicPaths = [
    '/api/auth/login',
    '/download-apk',
    '/app.apk'
  ];
  
  const isPublic = publicPaths.includes(req.path) || !req.path.startsWith('/api');
  if (isPublic) {
    return next();
  }
  
  const token = req.headers['authorization'];
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.user = activeSessions.get(token);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from frontend build if it exists
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Helper to determine asset status based on quantities
function calculateStatus(quantity, minQuantity) {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= minQuantity) return 'Low Stock';
  return 'Available';
}

// Helper to calculate status globally for a SKU/Name group and sync all matching database records
async function syncGlobalStatus(sku, name) {
  try {
    let query = 'SELECT * FROM assets WHERE 1=0';
    const params = [];
    
    if (sku && sku.trim() !== '') {
      query = 'SELECT * FROM assets WHERE sku = ? COLLATE NOCASE';
      params.push(sku.trim());
    } else if (name && name.trim() !== '') {
      query = 'SELECT * FROM assets WHERE name = ? COLLATE NOCASE';
      params.push(name.trim());
    } else {
      return; // nothing to sync
    }

    const matches = await dbAll(query, params);
    if (matches.length === 0) return;

    const totalQty = matches.reduce((sum, item) => sum + item.quantity, 0);
    const maxMinQty = matches.reduce((max, item) => Math.max(max, item.min_quantity || 0), 0);
    const newStatus = calculateStatus(totalQty, maxMinQty);

    // Update status for all matches in the database
    if (sku && sku.trim() !== '') {
      await dbRun('UPDATE assets SET status = ? WHERE sku = ? COLLATE NOCASE', [newStatus, sku.trim()]);
    } else {
      await dbRun('UPDATE assets SET status = ? WHERE name = ? COLLATE NOCASE', [newStatus, name.trim()]);
    }
  } catch (err) {
    console.error('Error syncing global status:', err);
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Assets Endpoints

// GET /api/assets - Search, filter, list
app.get('/api/assets', async (req, res) => {
  try {
    const { q, location_id, status } = req.query;
    let query = `
      SELECT assets.*, locations.name as location_name 
      FROM assets 
      LEFT JOIN locations ON assets.location_id = locations.id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      query += ` AND (assets.name LIKE ? OR assets.description LIKE ? OR assets.sku LIKE ? OR assets.id LIKE ?)`;
      const searchWildcard = `%${q}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (location_id) {
      query += ` AND assets.location_id = ?`;
      params.push(location_id);
    }

    if (status) {
      query += ` AND assets.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY assets.updated_at DESC`;

    const assets = await dbAll(query, params);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assets/:id - Get single asset details with transaction history
app.get('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await dbGet(`
      SELECT assets.*, locations.name as location_name 
      FROM assets 
      LEFT JOIN locations ON assets.location_id = locations.id
      WHERE assets.id = ?
    `, [id]);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get latest transactions for this asset
    const transactions = await dbAll(`
      SELECT transactions.*, locations.name as location_name
      FROM transactions
      LEFT JOIN locations ON transactions.location_id = locations.id
      WHERE transactions.asset_id = ?
      ORDER BY transactions.created_at DESC
      LIMIT 20
    `, [id]);

    res.json({ ...asset, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assets - Create a new asset
app.post('/api/assets', async (req, res) => {
  try {
    let { id, name, description, sku, quantity, unit, location_id, min_quantity } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Asset name is required' });
    }

    // Generate a QR code ID if none was scanned/supplied
    if (!id || id.trim() === '') {
      id = 'qr-' + crypto.randomBytes(4).toString('hex');
    }

    // Check uniqueness
    const existing = await dbGet('SELECT id FROM assets WHERE id = ?', [id]);
    if (existing) {
      return res.status(400).json({ error: `Asset with QR ID/SKU '${id}' already exists.` });
    }

    quantity = parseInt(quantity, 10) || 0;
    min_quantity = parseInt(min_quantity, 10) || 0;
    const status = calculateStatus(quantity, min_quantity);

    await dbRun(`
      INSERT INTO assets (id, name, description, sku, quantity, unit, location_id, status, min_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, description || '', sku || '', quantity, unit || 'pcs', location_id || null, status, min_quantity]);

    // Record initial transaction
    if (quantity > 0) {
      await dbRun(`
        INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes)
        VALUES (?, 'CHECK_IN', ?, ?, 'System', 'Initial asset creation with stock')
      `, [id, quantity, location_id || null]);
    }

    await syncGlobalStatus(sku || '', name);

    const createdAsset = await dbGet('SELECT * FROM assets WHERE id = ?', [id]);
    res.status(201).json(createdAsset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/assets/:id - Update asset parameters (non-stock changes)
app.put('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sku, unit, location_id, min_quantity } = req.body;

    const currentAsset = await dbGet('SELECT * FROM assets WHERE id = ?', [id]);
    if (!currentAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const minQtyVal = min_quantity !== undefined ? parseInt(min_quantity, 10) : currentAsset.min_quantity;
    const newStatus = calculateStatus(currentAsset.quantity, minQtyVal);

    const finalName = name || currentAsset.name;
    const finalSku = sku !== undefined ? sku : currentAsset.sku;

    await dbRun(`
      UPDATE assets 
      SET name = ?, description = ?, sku = ?, unit = ?, location_id = ?, min_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      finalName,
      description !== undefined ? description : currentAsset.description,
      finalSku,
      unit || currentAsset.unit,
      location_id !== undefined ? location_id : currentAsset.location_id,
      minQtyVal,
      newStatus,
      id
    ]);

    await syncGlobalStatus(finalSku, finalName);
    if (currentAsset.sku !== finalSku || currentAsset.name !== finalName) {
      await syncGlobalStatus(currentAsset.sku, currentAsset.name);
    }

    const updatedAsset = await dbGet('SELECT * FROM assets WHERE id = ?', [id]);
    res.json(updatedAsset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/assets/:id - Delete an asset from inventory
app.delete('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentAsset = await dbGet('SELECT * FROM assets WHERE id = ?', [id]);
    if (!currentAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await dbRun('DELETE FROM assets WHERE id = ?', [id]);
    await syncGlobalStatus(currentAsset.sku, currentAsset.name);

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Locations Endpoints

// GET /api/locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await dbAll(`
      SELECT locations.*, COUNT(assets.id) as asset_count 
      FROM locations 
      LEFT JOIN assets ON locations.id = assets.location_id
      GROUP BY locations.id
      ORDER BY locations.name ASC
    `);
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/locations
app.post('/api/locations', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const result = await dbRun('INSERT INTO locations (name, description) VALUES (?, ?)', [name, description || '']);
    const newLocation = await dbGet('SELECT * FROM locations WHERE id = ?', [result.id]);
    res.status(201).json(newLocation);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A location with this name already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/locations/:id
app.delete('/api/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Explicitly null out location references in assets
    await dbRun('UPDATE assets SET location_id = NULL WHERE location_id = ?', [id]);
    
    const result = await dbRun('DELETE FROM locations WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Transactions Endpoints

// GET /api/transactions - Global log list
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await dbAll(`
      SELECT transactions.*, assets.name as asset_name, locations.name as location_name 
      FROM transactions 
      LEFT JOIN assets ON transactions.asset_id = assets.id 
      LEFT JOIN locations ON transactions.location_id = locations.id 
      ORDER BY transactions.created_at DESC
      LIMIT 100
    `);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/transactions - Execute a stock change
app.post('/api/transactions', async (req, res) => {
  try {
    let { asset_id, type, quantity_change, user_name, location_id, notes, absolute_quantity } = req.body;

    if (!asset_id || !type || !user_name) {
      return res.status(400).json({ error: 'asset_id, type, and user_name are required' });
    }

    const asset = await dbGet('SELECT * FROM assets WHERE id = ?', [asset_id]);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    let finalChange = 0;
    let newQuantity = asset.quantity;

    if (type === 'STOCK_ADJUST') {
      const targetQuantity = absolute_quantity !== undefined ? parseInt(absolute_quantity, 10) : (parseInt(quantity_change, 10) || 0);
      finalChange = targetQuantity - asset.quantity;
      newQuantity = targetQuantity;
    } else {
      const changeVal = parseInt(quantity_change, 10) || 0;
      if (type === 'CHECK_IN' || type === 'PURCHASE') {
        finalChange = Math.abs(changeVal);
      } else if (type === 'CHECK_OUT' || type === 'SALE') {
        finalChange = -Math.abs(changeVal);
      }
      newQuantity = asset.quantity + finalChange;
    }

    // Verify stock availability for checkouts
    if (newQuantity < 0) {
      return res.status(400).json({ error: `Insufficient stock. Current inventory level is ${asset.quantity} ${asset.unit}.` });
    }

    const changeVal = parseInt(quantity_change, 10) || 0;
    const destLocationId = (location_id && location_id !== 'null' && location_id !== '') ? parseInt(location_id, 10) : null;
    const isTransfer = (type === 'CHECK_OUT' || type === 'SALE') && 
                       destLocationId && 
                       destLocationId !== asset.location_id;

    if (isTransfer) {
      // 1. Subtract changeVal from source asset
      const newSourceQty = asset.quantity - Math.abs(changeVal);
      const sourceStatus = calculateStatus(newSourceQty, asset.min_quantity);

      // Find location names for audit logging
      const sourceLocRow = await dbGet('SELECT name FROM locations WHERE id = ?', [asset.location_id]);
      const sourceLocationName = sourceLocRow ? sourceLocRow.name : 'Unknown Location';
      const destLocRow = await dbGet('SELECT name FROM locations WHERE id = ?', [destLocationId]);
      const destLocationName = destLocRow ? destLocRow.name : 'Unknown Location';

      // Perform source asset updates
      await dbRun(`
        UPDATE assets 
        SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [newSourceQty, sourceStatus, asset.id]);

      await dbRun(`
        INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes)
        VALUES (?, 'CHECK_OUT', ?, ?, ?, ?)
      `, [
        asset.id,
        -Math.abs(changeVal),
        asset.location_id,
        user_name,
        notes ? `${notes} (Transferred to ${destLocationName})` : `Transferred to ${destLocationName}`
      ]);

      // 2. Find if an asset with the same name already exists at the destination location
      let destAsset = await dbGet(
        'SELECT * FROM assets WHERE name = ? COLLATE NOCASE AND location_id = ?',
        [asset.name, destLocationId]
      );

      if (destAsset) {
        const newDestQty = destAsset.quantity + Math.abs(changeVal);
        const destStatus = calculateStatus(newDestQty, destAsset.min_quantity);
        await dbRun(
          'UPDATE assets SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newDestQty, destStatus, destAsset.id]
        );
        await dbRun(`
          INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes)
          VALUES (?, 'CHECK_IN', ?, ?, ?, ?)
        `, [
          destAsset.id,
          Math.abs(changeVal),
          destLocationId,
          user_name,
          notes ? `${notes} (Transferred from ${sourceLocationName})` : `Transferred from ${sourceLocationName}`
        ]);
      } else {
        // Create new asset record at the destination
        const newAssetId = 'qr-' + crypto.randomBytes(4).toString('hex');
        const initialDestQty = Math.abs(changeVal);
        const destStatus = calculateStatus(initialDestQty, asset.min_quantity);
        await dbRun(`
          INSERT INTO assets (id, name, description, sku, quantity, unit, location_id, status, min_quantity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newAssetId,
          asset.name,
          asset.description || '',
          asset.sku || '',
          initialDestQty,
          asset.unit || 'pcs',
          destLocationId,
          destStatus,
          asset.min_quantity
        ]);
        await dbRun(`
          INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes)
          VALUES (?, 'CHECK_IN', ?, ?, ?, ?)
        `, [
          newAssetId,
          initialDestQty,
          destLocationId,
          user_name,
          notes ? `${notes} (Transferred from ${sourceLocationName})` : `Transferred from ${sourceLocationName}`
        ]);
      }

      // Sync global status before returning
      await syncGlobalStatus(asset.sku, asset.name);

      // Return updated source asset
      const updatedAsset = await dbGet(`
        SELECT assets.*, locations.name as location_name 
        FROM assets 
        LEFT JOIN locations ON assets.location_id = locations.id
        WHERE assets.id = ?
      `, [asset.id]);
      return res.json(updatedAsset);
    }

    const status = calculateStatus(newQuantity, asset.min_quantity);
    const destLocation = location_id || asset.location_id;

    // Begin updates
    await dbRun(`
      UPDATE assets 
      SET quantity = ?, status = ?, location_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [newQuantity, status, destLocation, asset_id]);

    await dbRun(`
      INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [asset_id, type, finalChange, destLocation, user_name, notes || '']);

    // Sync global status before returning
    await syncGlobalStatus(asset.sku, asset.name);

    const updatedAsset = await dbGet(`
      SELECT assets.*, locations.name as location_name 
      FROM assets 
      LEFT JOIN locations ON assets.location_id = locations.id
      WHERE assets.id = ?
    `, [asset_id]);

    res.json(updatedAsset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Users Endpoints

// GET /api/users
// GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const users = await dbAll('SELECT id, name, role, created_at FROM users ORDER BY name ASC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users
app.post('/api/users', async (req, res) => {
  try {
    const { name, role, password } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    const defaultPassword = password || (name.toLowerCase() + '123');
    const { salt, hash } = hashPassword(defaultPassword);

    const result = await dbRun(
      'INSERT INTO users (name, role, password_hash, salt) VALUES (?, ?, ?, ?)', 
      [name, role, hash, salt]
    );
    const newUser = await dbGet('SELECT id, name, role, created_at FROM users WHERE id = ?', [result.id]);
    res.status(201).json(newUser);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A user with this name already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, password } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    if (password) {
      const { salt, hash } = hashPassword(password);
      await dbRun(
        'UPDATE users SET name = ?, role = ?, password_hash = ?, salt = ? WHERE id = ?', 
        [name, role, hash, salt, id]
      );
    } else {
      await dbRun('UPDATE users SET name = ?, role = ? WHERE id = ?', [name, role, id]);
    }

    const updatedUser = await dbGet('SELECT id, name, role, created_at FROM users WHERE id = ?', [id]);
    res.json(updatedUser);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A user with this name already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbRun('DELETE FROM users WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Admin Panel Settings Endpoints

// POST /api/admin/purge-logs
app.post('/api/admin/purge-logs', async (req, res) => {
  try {
    await dbRun('DELETE FROM transactions');
    res.json({ message: 'All transaction logs cleared successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/seed-activity
app.post('/api/admin/seed-activity', async (req, res) => {
  try {
    const assets = await dbAll('SELECT id, quantity FROM assets');
    const users = await dbAll('SELECT name FROM users');
    const locations = await dbAll('SELECT id FROM locations');

    if (assets.length === 0 || users.length === 0) {
      return res.status(400).json({ error: 'Need assets and users in database to seed activity.' });
    }

    const types = ['CHECK_IN', 'CHECK_OUT', 'STOCK_ADJUST'];
    const notesOptions = [
      'Regular weekly stock audit',
      'Material withdrawal for engineering desk tests',
      'Restocked from recent purchasing order',
      'Transferred parts to main inventory shelf',
      'Checked out for Dan prototype lab'
    ];

    for (let i = 0; i < 12; i++) {
      const randAsset = assets[Math.floor(Math.random() * assets.length)];
      const randUser = users[Math.floor(Math.random() * users.length)];
      const randLocation = locations.length > 0 ? locations[Math.floor(Math.random() * locations.length)].id : null;
      const type = types[Math.floor(Math.random() * types.length)];
      
      let change = 0;
      if (type === 'CHECK_IN') {
        change = Math.floor(Math.random() * 15) + 1;
      } else if (type === 'CHECK_OUT') {
        change = -(Math.floor(Math.random() * Math.min(4, randAsset.quantity || 1)) + 1);
      } else {
        change = Math.floor(Math.random() * 10) - 4;
      }

      const notes = notesOptions[Math.floor(Math.random() * notesOptions.length)];
      const hoursAgo = 12 - i;
      
      await dbRun(`
        INSERT INTO transactions (asset_id, type, quantity_change, location_id, user_name, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${hoursAgo} hours'))
      `, [randAsset.id, type, change, randLocation, randUser.name, notes]);

      // Update asset quantity
      const currentQty = randAsset.quantity || 0;
      const newQty = Math.max(0, currentQty + change);
      const status = calculateStatus(newQty, randAsset.min_quantity || 0);
      
      await dbRun('UPDATE assets SET quantity = ?, status = ? WHERE id = ?', [newQty, status, randAsset.id]);
    }

    res.json({ message: 'Dummy activity logs seeded successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// AUTHENTICATION & LOGIN
// ----------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await dbGet('SELECT * FROM users WHERE name = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = verifyPassword(password, user.salt, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, { id: user.id, name: user.name, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me - Verify session token
app.get('/api/auth/me', (req, res) => {
  res.json(req.user);
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization'];
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/change-password - Change current user's password
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const dbUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!verifyPassword(currentPassword, dbUser.salt, dbUser.password_hash)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const { salt, hash } = hashPassword(newPassword);
    await dbRun(
      'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?',
      [hash, salt, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// DATABASE BACKUP & RESTORE
// ----------------------------------------------------

// GET /api/admin/backup - Download raw SQLite database
app.get('/api/admin/backup', (req, res) => {
  // Only Admin users can trigger backup download
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'inventory.db');
  res.download(dbPath, `backup-${Date.now()}.db`, (err) => {
    if (err) {
      console.error("Backup download error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download backup file' });
      }
    }
  });
});

// POST /api/admin/restore - Restore SQLite database file upload
app.post('/api/admin/restore', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  // Only Admin users can trigger backup restore
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    const rawBuffer = req.body;
    if (!rawBuffer || rawBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty file payload' });
    }

    // Verify it looks like a valid SQLite database header (SQLite format 3 starts with 'SQLite format 3\0')
    const sqliteHeader = 'SQLite format 3\0';
    const headerSlice = rawBuffer.slice(0, 16).toString('binary');
    if (!headerSlice.startsWith(sqliteHeader)) {
      return res.status(400).json({ error: 'Invalid file format: Not a valid SQLite database' });
    }

    await restoreDatabaseFile(rawBuffer);
    res.json({ message: 'Database restored successfully! Reconnected connection pools.' });
  } catch (error) {
    console.error("Database restore error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// MOBILE APK FILE HOSTING
// ----------------------------------------------------

// POST /api/admin/upload-apk - Upload mobile application package
app.post('/api/admin/upload-apk', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    const rawBuffer = req.body;
    if (!rawBuffer || rawBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty APK file payload' });
    }

    const apkPath = path.join(__dirname, 'public', 'app.apk');
    
    // Ensure public folder exists
    const publicFolder = path.dirname(apkPath);
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }

    fs.writeFileSync(apkPath, rawBuffer);
    console.log("New mobile APK uploaded successfully.");
    res.json({ message: 'Mobile APK uploaded successfully! Ready for downloads.' });
  } catch (error) {
    console.error("APK upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /download-apk or /app.apk - Serve the hosted APK download
app.get('/download-apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'app.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'asset-manager.apk');
  } else {
    res.status(404).send('Mobile app APK file has not been uploaded by the system administrator yet.');
  }
});

app.get('/app.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'app.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'asset-manager.apk');
  } else {
    res.status(404).send('Mobile app APK file has not been uploaded by the system administrator yet.');
  }
});

// ----------------------------------------------------
// FRONTEND ROUTE CALLBACK (Single Page App Fallback)
// ----------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Initialize database and start listening
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`==========================================`);
    console.log(`Asset Manager Server listening on port ${PORT}`);
    console.log(`Backend API: http://localhost:${PORT}/api`);
    console.log(`==========================================`);
  });
});
