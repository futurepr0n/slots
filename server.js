// Simple Node.js server using built-in modules
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mysql = require('mysql2/promise'); // Using promise version for async/await
const crypto = require('crypto');
// Server configuration
const port = 3000;
const jackpotDataPath = path.join(__dirname, 'jackpot-data.json');
const usersDataPath = path.join(__dirname, 'users.json');

// File lock mechanisms to prevent concurrent writes
let jackpotFileLock = false;
let usersFileLock = false;

// MySQL Database configuration
const dbConfig = {
    host: 'markpereira.com',     // Update with your DB host
    user: 'mark5463_slotadmin', // Update with your DB username
    password: 'Sl0t4dm1n66!', // Update with your DB password
    database: 'mark5463_slots',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);


// Initialize jackpot data file if it doesn't exist
/* if (!fs.existsSync(jackpotDataPath)) {
    const initialData = {
        jackpotRoyale: 10000.00,
        lastJackpotWon: 0.00,
        lastJackpotDate: "",
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(jackpotDataPath, JSON.stringify(initialData, null, 2));
    console.log(`Created initial jackpot data file at: ${jackpotDataPath}`);
} */

// Initialize users data file if it doesn't exist
/* if (!fs.existsSync(usersDataPath)) {
    const initialData = {
        users: {},
        leaderboard: {
            topWinner: "",
            mostWon: 0
        },
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(usersDataPath, JSON.stringify(initialData, null, 2));
    console.log(`Created initial users data file at: ${usersDataPath}`);
} */

// File extension to MIME types mapping
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif'
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // Enable CORS for all routes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    // Helper function to generate a unique fingerprint for users
    function generateFingerprint(req) {
        // Generate a fingerprint based on IP and user agent
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'unknown';
        const data = ip + userAgent;
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    // Handle API endpoints
    if (pathname === '/save-jackpot') {
        try {
            const data = parsedUrl.query.data;
            if (!data) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No data provided' }));
                return;
            }

            // Parse the data
            const jackpotData = JSON.parse(decodeURIComponent(data));
            
            // Validate jackpot data
            if (typeof jackpotData.jackpotRoyale !== 'number' || 
                isNaN(jackpotData.jackpotRoyale) || 
                jackpotData.jackpotRoyale < 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid jackpot data' }));
                return;
            }
            
            // Ensure minimum jackpot value
            if (jackpotData.jackpotRoyale < 1000) {
                jackpotData.jackpotRoyale = 10000.00;
            }
            
            // Round to 2 decimal places for consistency
            const jackpotAmount = Math.round(jackpotData.jackpotRoyale * 100) / 100;
            
            // Update jackpot in database
            let lastJackpotAmount = null;
            let lastJackpotDate = null;
            
            // If a jackpot was won, update the last jackpot fields
            if (jackpotData.lastJackpotWon > 0) {
                lastJackpotAmount = jackpotData.lastJackpotWon;
                lastJackpotDate = jackpotData.lastJackpotDate 
                    ? new Date(jackpotData.lastJackpotDate) 
                    : new Date();
            }
            
            // Update the jackpot in the database
            const connection = await pool.getConnection();
            try {
                // First check if the jackpot record exists
                const [rows] = await connection.query(
                    'SELECT * FROM jackpots WHERE jackpot_name = ?', 
                    ['main']
                );
                
                if (rows.length > 0) {
                    // Update existing record
                    const updateQuery = `
                        UPDATE jackpots 
                        SET jackpot_amount = ?,
                            last_jackpot_amount = COALESCE(?, last_jackpot_amount),
                            last_jackpot_date = COALESCE(?, last_jackpot_date)
                        WHERE jackpot_name = ?
                    `;
                    await connection.query(updateQuery, [
                        jackpotAmount, 
                        lastJackpotAmount, 
                        lastJackpotDate, 
                        'main'
                    ]);
                } else {
                    // Insert new record
                    const insertQuery = `
                        INSERT INTO jackpots 
                        (jackpot_name, jackpot_amount, last_jackpot_amount, last_jackpot_date) 
                        VALUES (?, ?, ?, ?)
                    `;
                    await connection.query(insertQuery, [
                        'main', 
                        jackpotAmount, 
                        lastJackpotAmount, 
                        lastJackpotDate
                    ]);
                }
                
                // Get the updated jackpot data
                const [updated] = await connection.query(
                    'SELECT * FROM jackpots WHERE jackpot_name = ?', 
                    ['main']
                );
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    data: {
                        jackpotRoyale: updated[0].jackpot_amount,
                        lastJackpotWon: updated[0].last_jackpot_amount || 0,
                        lastJackpotDate: updated[0].last_jackpot_date 
                            ? updated[0].last_jackpot_date.toISOString().split('T')[0].replace(/-/g, '/') 
                            : "",
                        lastUpdated: updated[0].last_updated
                    }
                }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error saving jackpot data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save jackpot data' }));
        }
        return;
    }
    
    if (pathname === '/load-jackpot') {
        try {
            const connection = await pool.getConnection();
            try {
                // Get jackpot data from database
                const [rows] = await connection.query(
                    'SELECT * FROM jackpots WHERE jackpot_name = ?', 
                    ['main']
                );
                
                if (rows.length > 0) {
                    const jackpotData = {
                        jackpotRoyale: rows[0].jackpot_amount,
                        lastJackpotWon: rows[0].last_jackpot_amount || 0,
                        lastJackpotDate: rows[0].last_jackpot_date 
                            ? rows[0].last_jackpot_date.toISOString().split('T')[0].replace(/-/g, '/') 
                            : "",
                        lastUpdated: rows[0].last_updated
                    };
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(jackpotData));
                } else {
                    // Insert default jackpot data if none exists
                    await connection.query(
                        'INSERT INTO jackpots (jackpot_name, jackpot_amount) VALUES (?, ?)',
                        ['main', 10000.00]
                    );
                    
                    const defaultData = {
                        jackpotRoyale: 10000.00,
                        lastJackpotWon: 0,
                        lastJackpotDate: "",
                        lastUpdated: new Date().toISOString()
                    };
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(defaultData));
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error loading jackpot data:', error);
            
            // Return default data in case of error
            const defaultData = {
                jackpotRoyale: 10000.00,
                lastJackpotWon: 0,
                lastJackpotDate: "",
                lastUpdated: new Date().toISOString()
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(defaultData));
        }
        return;
    }

    // Save user data
    if (pathname === '/save-user') {
        try {
            const data = parsedUrl.query.data;
            if (!data) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No user data provided' }));
                return;
            }
    
            // Parse the data
            const userData = JSON.parse(decodeURIComponent(data));
            const username = userData.username;
            
            if (!username) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Username is required' }));
                return;
            }
            
            // Generate unique fingerprint for this user
            const uniqueIdentifier = generateFingerprint(req);
            
            const connection = await pool.getConnection();
            try {
                // Check if user exists
                const [existingUsers] = await connection.query(
                    'SELECT * FROM users WHERE unique_identifier = ? AND username = ?',
                    [uniqueIdentifier, username]
                );
                
                let userId;
                
                if (existingUsers.length > 0) {
                    // Update existing user
                    userId = existingUsers[0].id;
                    await connection.query(
                        `UPDATE users 
                         SET total_won = ?, 
                             total_wagered = ?,
                             bankroll = ?
                         WHERE id = ?`,
                        [
                            userData.totalWon || existingUsers[0].total_won,
                            userData.totalWagered || existingUsers[0].total_wagered,
                            userData.bankroll || existingUsers[0].bankroll,
                            userId
                        ]
                    );
                } else {
                    // Create new user
                    const [result] = await connection.query(
                        `INSERT INTO users 
                         (username, unique_identifier, total_won, total_wagered, bankroll)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            username,
                            uniqueIdentifier,
                            userData.totalWon || 0,
                            userData.totalWagered || 0,
                            userData.bankroll || 0
                        ]
                    );
                    userId = result.insertId;
                }
                
                // Get updated user data
                const [updatedUser] = await connection.query(
                    'SELECT * FROM users WHERE id = ?',
                    [userId]
                );
                
                // Check if this user has custom symbols
                const [customSymbols] = await connection.query(
                    'SELECT symbol_name, image_data FROM custom_symbols WHERE user_id = ?',
                    [userId]
                );
                
                // Prepare custom symbols object
                const customSymbolsObj = {};
                customSymbols.forEach(symbol => {
                    customSymbolsObj[symbol.symbol_name] = symbol.image_data;
                });
                
                // Get leaderboard data
                const [leaderboardData] = await connection.query(
                    `SELECT username, total_won FROM users ORDER BY total_won DESC LIMIT 1`
                );
                
                const leaderboard = {
                    topWinner: leaderboardData.length > 0 ? leaderboardData[0].username : "",
                    mostWon: leaderboardData.length > 0 ? leaderboardData[0].total_won : 0
                };
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    data: {
                        id: updatedUser[0].id,
                        username: updatedUser[0].username,
                        totalWon: updatedUser[0].total_won,
                        totalWagered: updatedUser[0].total_wagered,
                        bankroll: updatedUser[0].bankroll,
                        customSymbols: customSymbolsObj,
                        uniqueIdentifier: uniqueIdentifier
                    },
                    leaderboard: leaderboard
                }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error saving user data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save user data' }));
        }
        return;
    }
    
    // Load user data
    if (pathname === '/load-users') {
        try {
            // Generate unique fingerprint for this user
            const uniqueIdentifier = generateFingerprint(req);
            
            const connection = await pool.getConnection();
            try {
                // Get all users with this fingerprint
                const [users] = await connection.query(
                    'SELECT * FROM users WHERE unique_identifier = ?',
                    [uniqueIdentifier]
                );
                
                // Get leaderboard data - top winner by total won
                const [leaderboardData] = await connection.query(
                    `SELECT username, total_won FROM users ORDER BY total_won DESC LIMIT 1`
                );
                
                const usersObj = {};
                users.forEach(user => {
                    usersObj[user.username] = {
                        id: user.id,
                        username: user.username,
                        totalWon: user.total_won,
                        totalWagered: user.total_wagered,
                        bankroll: user.bankroll
                    };
                });
                
                const leaderboard = {
                    topWinner: leaderboardData.length > 0 ? leaderboardData[0].username : "",
                    mostWon: leaderboardData.length > 0 ? leaderboardData[0].total_won : 0
                };
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    users: usersObj,
                    leaderboard: leaderboard,
                    uniqueIdentifier: uniqueIdentifier
                }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error loading users data:', error);
            
            // Return empty data in case of error
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                users: {},
                leaderboard: {
                    topWinner: "",
                    mostWon: 0
                },
                uniqueIdentifier: generateFingerprint(req)
            }));
        }
        return;
    }

    // Save spin history
    if (pathname === '/record-spin') {
        try {
            const data = parsedUrl.query.data;
            if (!data) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No spin data provided' }));
                return;
            }

            // Parse the data
            const spinData = JSON.parse(decodeURIComponent(data));
            
            if (!spinData.userId || !spinData.stake) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User ID and stake are required' }));
                return;
            }
            
            const connection = await pool.getConnection();
            try {
                // Record spin in database
                await connection.query(
                    `INSERT INTO spin_history 
                     (user_id, stake, win_amount, is_jackpot, reel1_symbols, reel2_symbols, reel3_symbols)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        spinData.userId,
                        spinData.stake,
                        spinData.winAmount || 0,
                        spinData.isJackpot || false,
                        JSON.stringify(spinData.reel1Symbols || []),
                        JSON.stringify(spinData.reel2Symbols || []),
                        JSON.stringify(spinData.reel3Symbols || [])
                    ]
                );
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error recording spin:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to record spin' }));
        }
        return;
    }

    // Save custom symbol
    if (pathname === '/save-custom-symbol') {
        try {
            const data = parsedUrl.query.data;
            if (!data) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No symbol data provided' }));
                return;
            }

            // Parse the data
            const symbolData = JSON.parse(decodeURIComponent(data));
            
            if (!symbolData.userId || !symbolData.symbolName || !symbolData.imageData) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User ID, symbol name, and image data are required' }));
                return;
            }
            
            const connection = await pool.getConnection();
            try {
                // Check if symbol already exists for this user
                const [existingSymbols] = await connection.query(
                    'SELECT * FROM custom_symbols WHERE user_id = ? AND symbol_name = ?',
                    [symbolData.userId, symbolData.symbolName]
                );
                
                if (existingSymbols.length > 0) {
                    // Update existing symbol
                    await connection.query(
                        `UPDATE custom_symbols 
                         SET image_data = ?
                         WHERE user_id = ? AND symbol_name = ?`,
                        [symbolData.imageData, symbolData.userId, symbolData.symbolName]
                    );
                } else {
                    // Create new symbol
                    await connection.query(
                        `INSERT INTO custom_symbols 
                         (user_id, symbol_name, image_data)
                         VALUES (?, ?, ?)`,
                        [symbolData.userId, symbolData.symbolName, symbolData.imageData]
                    );
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error saving custom symbol:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save custom symbol' }));
        }
        return;
    }

    // Delete custom symbol
    if (pathname === '/delete-custom-symbol') {
        try {
            const userId = parsedUrl.query.userId;
            const symbolName = parsedUrl.query.symbolName;
            
            if (!userId || !symbolName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User ID and symbol name are required' }));
                return;
            }
            
            const connection = await pool.getConnection();
            try {
                // Delete the symbol
                await connection.query(
                    'DELETE FROM custom_symbols WHERE user_id = ? AND symbol_name = ?',
                    [userId, symbolName]
                );
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error deleting custom symbol:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to delete custom symbol' }));
        }
        return;
    }

    // Load custom symbols
    if (pathname === '/load-custom-symbols') {
        try {
            const userId = parsedUrl.query.userId;
            
            if (!userId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User ID is required' }));
                return;
            }
            
            const connection = await pool.getConnection();
            try {
                // Get all custom symbols for this user
                const [symbols] = await connection.query(
                    'SELECT symbol_name, image_data FROM custom_symbols WHERE user_id = ?',
                    [userId]
                );
                
                const symbolsObj = {};
                symbols.forEach(symbol => {
                    symbolsObj[symbol.symbol_name] = symbol.image_data;
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    customSymbols: symbolsObj
                }));
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error loading custom symbols:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to load custom symbols' }));
        }
        return;
    }


    // Handle file requests
    let filePath = pathname === '/' ? 
        path.join(__dirname, 'index.html') : 
        path.join(__dirname, pathname);
    
    const extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`File not found: ${filePath}`);
                res.writeHead(404);
                res.end('File not found');
            } else {
                console.error(`Server error: ${err.code}`);
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Function to initialize the database if needed
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        try {
            // Check if jackpots table exists, create if not
            await connection.query(`
                CREATE TABLE IF NOT EXISTS jackpots (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    jackpot_name VARCHAR(50) NOT NULL DEFAULT 'main',
                    jackpot_amount DECIMAL(12, 2) NOT NULL DEFAULT 10000.00,
                    last_jackpot_amount DECIMAL(12, 2) DEFAULT NULL,
                    last_jackpot_date DATETIME DEFAULT NULL,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY (jackpot_name)
                )
            `);
            
            // Check if users table exists, create if not
            await connection.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    unique_identifier VARCHAR(64) NOT NULL,
                    total_won DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    total_wagered DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    bankroll DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_played DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY (unique_identifier, username)
                )
            `);
            
            // Check if spin_history table exists, create if not
            await connection.query(`
                CREATE TABLE IF NOT EXISTS spin_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    stake DECIMAL(8, 2) NOT NULL,
                    win_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    is_jackpot BOOLEAN NOT NULL DEFAULT FALSE,
                    spin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    reel1_symbols VARCHAR(100),
                    reel2_symbols VARCHAR(100),
                    reel3_symbols VARCHAR(100),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            
            // Check if custom_symbols table exists, create if not
            await connection.query(`
                CREATE TABLE IF NOT EXISTS custom_symbols (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    symbol_name VARCHAR(50) NOT NULL,
                    image_data MEDIUMTEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY (user_id, symbol_name),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            
            // Check if main jackpot record exists, create if not
            const [jackpotRows] = await connection.query(
                'SELECT * FROM jackpots WHERE jackpot_name = ?', 
                ['main']
            );
            
            if (jackpotRows.length === 0) {
                // Insert default jackpot data
                await connection.query(
                    'INSERT INTO jackpots (jackpot_name, jackpot_amount) VALUES (?, ?)',
                    ['main', 10000.00]
                );
                console.log('Created initial jackpot record');
            }
            
            console.log('Database initialized successfully');
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Start server
async function startServer() {
    // Initialize database first
    await initializeDatabase();
    
    // Then start the server
    server.listen(port, () => {
        console.log(`Slot machine server running at http://localhost:${port}`);
        console.log(`Connected to MySQL database: ${dbConfig.database}`);
    });
}

startServer();