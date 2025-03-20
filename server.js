// Simple Node.js server using built-in modules
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Server configuration
const port = 3000;
const jackpotDataPath = path.join(__dirname, 'jackpot-data.json');
const usersDataPath = path.join(__dirname, 'users.json');

// File lock mechanisms to prevent concurrent writes
let jackpotFileLock = false;
let usersFileLock = false;

// Initialize jackpot data file if it doesn't exist
if (!fs.existsSync(jackpotDataPath)) {
    const initialData = {
        jackpotRoyale: 10000.00,
        lastJackpotWon: 0.00,
        lastJackpotDate: "",
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(jackpotDataPath, JSON.stringify(initialData, null, 2));
    console.log(`Created initial jackpot data file at: ${jackpotDataPath}`);
}

// Initialize users data file if it doesn't exist
if (!fs.existsSync(usersDataPath)) {
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
}

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
const server = http.createServer((req, res) => {
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
    
    // Handle API endpoints
    if (pathname === '/save-jackpot') {
        try {
            if (jackpotFileLock) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File is being written by another request' }));
                return;
            }
            
            jackpotFileLock = true;
            
            const data = parsedUrl.query.data;
            if (!data) {
                jackpotFileLock = false;
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
                jackpotFileLock = false;
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid jackpot data' }));
                return;
            }
            
            // Ensure minimum jackpot value
            if (jackpotData.jackpotRoyale < 1000) {
                jackpotData.jackpotRoyale = 10000.00;
            }
            
            // Round to 2 decimal places for consistency
            jackpotData.jackpotRoyale = Math.round(jackpotData.jackpotRoyale * 100) / 100;
            
            try {
                // Check if the file exists
                let existingData;
                if (fs.existsSync(jackpotDataPath)) {
                    // Read the existing file
                    const fileContent = fs.readFileSync(jackpotDataPath, 'utf8');
                    existingData = JSON.parse(fileContent);
                    
                    // Add source info for debugging
                    jackpotData.source = req.headers['user-agent'] || 'unknown';
                    
                    // Update only specific fields
                    existingData.jackpotRoyale = jackpotData.jackpotRoyale;
                    if (jackpotData.lastJackpotWon !== undefined) {
                        existingData.lastJackpotWon = jackpotData.lastJackpotWon;
                    }
                    if (jackpotData.lastJackpotDate !== undefined) {
                        existingData.lastJackpotDate = jackpotData.lastJackpotDate;
                    }
                } else {
                    // File doesn't exist, use the provided data
                    existingData = jackpotData;
                }
                
                // Add timestamp
                existingData.lastUpdated = new Date().toISOString();
                
                // Write to file
                fs.writeFileSync(jackpotDataPath, JSON.stringify(existingData, null, 2));
                
                jackpotFileLock = false;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    data: existingData
                }));
            } catch (fileError) {
                jackpotFileLock = false;
                console.error('Error with jackpot file:', fileError);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File operation failed' }));
            }
        } catch (error) {
            jackpotFileLock = false;
            console.error('Error saving jackpot data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save jackpot data' }));
        }
        return;
    }
    
    if (pathname === '/load-jackpot') {
        try {
            console.log('Loading jackpot data requested by:', req.headers['user-agent'] || 'unknown');
            
            // Check if the file exists
            if (!fs.existsSync(jackpotDataPath)) {
                console.log('Jackpot file not found, creating default');
                const initialData = {
                    jackpotRoyale: 10000.00,
                    lastJackpotWon: 0.00,
                    lastJackpotDate: "",
                    lastUpdated: new Date().toISOString()
                };
                fs.writeFileSync(jackpotDataPath, JSON.stringify(initialData, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(initialData));
                return;
            }
            
            // Read the file
            const fileContent = fs.readFileSync(jackpotDataPath, 'utf8');
            let jackpotData;
            
            try {
                jackpotData = JSON.parse(fileContent);
                console.log('Returning jackpot data:', jackpotData);
                
                // Validate data
                if (typeof jackpotData.jackpotRoyale !== 'number' || isNaN(jackpotData.jackpotRoyale)) {
                    console.warn('Invalid jackpot value in file, using default');
                    jackpotData.jackpotRoyale = 10000.00;
                }
            } catch (jsonError) {
                console.error('Error parsing jackpot data JSON:', jsonError);
                jackpotData = {
                    jackpotRoyale: 10000.00,
                    lastJackpotWon: 0.00,
                    lastJackpotDate: "",
                    lastUpdated: new Date().toISOString()
                };
                
                // Repair the file
                fs.writeFileSync(jackpotDataPath, JSON.stringify(jackpotData, null, 2));
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jackpotData));
        } catch (error) {
            console.error('Error loading jackpot data:', error);
            const defaultData = {
                jackpotRoyale: 10000.00,
                lastJackpotWon: 0.00,
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
            if (usersFileLock) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User file is being written by another request' }));
                return;
            }
            
            usersFileLock = true;
            
            const data = parsedUrl.query.data;
            if (!data) {
                usersFileLock = false;
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No user data provided' }));
                return;
            }

            // Parse the data
            const userData = JSON.parse(decodeURIComponent(data));
            const username = userData.username;
            
            if (!username) {
                usersFileLock = false;
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Username is required' }));
                return;
            }
            
            // Load existing users data
            let usersData = {};
            if (fs.existsSync(usersDataPath)) {
                usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
            } else {
                usersData = {
                    users: {},
                    leaderboard: {
                        topWinner: "",
                        mostWon: 0
                    },
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Update or create user
            if (!usersData.users[username]) {
                usersData.users[username] = {
                    totalWon: 0,
                    totalWagered: 0,
                    bankroll: 0,
                    lastPlayed: new Date().toISOString()
                };
            }
            
            // Update existing user data
            usersData.users[username].totalWon = userData.totalWon !== undefined ? 
                userData.totalWon : usersData.users[username].totalWon;
                
            usersData.users[username].totalWagered = userData.totalWagered !== undefined ? 
                userData.totalWagered : usersData.users[username].totalWagered;
                
            usersData.users[username].bankroll = userData.bankroll !== undefined ? 
                userData.bankroll : usersData.users[username].bankroll;
                
            usersData.users[username].lastPlayed = new Date().toISOString();
            
            // Update leaderboard if necessary
            if (usersData.users[username].totalWon > usersData.leaderboard.mostWon) {
                usersData.leaderboard.topWinner = username;
                usersData.leaderboard.mostWon = usersData.users[username].totalWon;
            }
            
            usersData.lastUpdated = new Date().toISOString();
            
            // Save to file
            fs.writeFileSync(usersDataPath, JSON.stringify(usersData, null, 2));
            usersFileLock = false;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true,
                data: usersData.users[username]
            }));
        } catch (error) {
            usersFileLock = false;
            console.error('Error saving user data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save user data' }));
        }
        return;
    }
    
    // Load user data
    if (pathname === '/load-users') {
        try {
            if (!fs.existsSync(usersDataPath)) {
                // Create default users data if it doesn't exist
                const initialData = {
                    users: {},
                    leaderboard: {
                        topWinner: "",
                        mostWon: 0
                    },
                    lastUpdated: new Date().toISOString()
                };
                fs.writeFileSync(usersDataPath, JSON.stringify(initialData, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(initialData));
                return;
            }
            
            // Read file
            const usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(usersData));
        } catch (error) {
            console.error('Error loading users data:', error);
            
            // Return empty data in case of error
            const defaultData = {
                users: {},
                leaderboard: {
                    topWinner: "",
                    mostWon: 0
                },
                lastUpdated: new Date().toISOString()
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(defaultData));
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

// Start server
server.listen(port, () => {
    console.log(`Slot machine server running at http://localhost:${port}`);
    console.log(`Jackpot data will be stored at: ${jackpotDataPath}`);
    console.log(`User data will be stored at: ${usersDataPath}`);
});