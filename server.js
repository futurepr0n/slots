// Simple Node.js server using only built-in modules - NO DEPENDENCIES NEEDED
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Server configuration
const port = 3000;
const jackpotDataPath = path.join(__dirname, 'jackpot-data.json');
const usersDataPath = path.join(__dirname, 'users.json');

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
            
            // Save to file
            fs.writeFileSync(jackpotDataPath, JSON.stringify(jackpotData, null, 2));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            console.error('Error saving jackpot data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save jackpot data' }));
        }
        return;
    }
    
    if (pathname === '/load-jackpot') {
        try {
            if (!fs.existsSync(jackpotDataPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Jackpot data not found' }));
                return;
            }
            
            // Read file
            const jackpotData = JSON.parse(fs.readFileSync(jackpotDataPath, 'utf8'));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jackpotData));
        } catch (error) {
            console.error('Error loading jackpot data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to load jackpot data' }));
        }
        return;
    }

    // NEW ENDPOINT: Save user data
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
                    lastPlayed: new Date().toISOString()
                };
            } else {
                // Update existing user data
                usersData.users[username].totalWon = userData.totalWon || usersData.users[username].totalWon;
                usersData.users[username].totalWagered = userData.totalWagered || usersData.users[username].totalWagered;
                usersData.users[username].lastPlayed = new Date().toISOString();
            }
            
            // Update leaderboard if necessary
            if (usersData.users[username].totalWon > usersData.leaderboard.mostWon) {
                usersData.leaderboard.topWinner = username;
                usersData.leaderboard.mostWon = usersData.users[username].totalWon;
            }
            
            usersData.lastUpdated = new Date().toISOString();
            
            // Save to file
            fs.writeFileSync(usersDataPath, JSON.stringify(usersData, null, 2));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            console.error('Error saving user data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save user data' }));
        }
        return;
    }
    
    // NEW ENDPOINT: Load user data
    if (pathname === '/load-users') {
        try {
            if (!fs.existsSync(usersDataPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Users data not found' }));
                return;
            }
            
            // Read file
            const usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(usersData));
        } catch (error) {
            console.error('Error loading users data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to load users data' }));
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