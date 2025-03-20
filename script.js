// Check if middle row has 3 stars for jackpot
function checkForJackpot(visibleSymbols) {
    // Check if all 3 middle row symbols are stars
    if (visibleSymbols[0][1] && visibleSymbols[1][1] && visibleSymbols[2][1] &&
        visibleSymbols[0][1].type === 'star' && 
        visibleSymbols[1][1].type === 'star' && 
        visibleSymbols[2][1].type === 'star') {
        return true;
    }
    return false;
}

// Game variables
let credits = 100;
let stake = 1;
let isSpinning = false;
let reels = [];
let winAmount = 0;

// Jackpot variables
let jackpotRoyale = 10000.00; // Starting value for jackpot
let lastJackpotWon = 0.00;    // Amount of last jackpot win
let lastJackpotDate = "";     // Date of last jackpot win

// User data variables
let currentUser = {
    username: "Guest",
    totalWon: 0,
    totalWagered: 0
};
let leaderboard = {
    topWinner: "",
    mostWon: 0
};

// Minimum and maximum stake
const MIN_STAKE = 0.25;
const MAX_STAKE = 10;
const STAKE_STEP = 0.25;

// Symbol dimensions
const SYMBOL_HEIGHT = 100;
const SYMBOLS_PER_REEL = 20; // Total symbols to create per reel
const VISIBLE_SYMBOLS = 3;   // Number of symbols visible in the window

// Amount to add to jackpot on each spin (as percentage of stake)
const JACKPOT_INCREMENT_PERCENT = 100; // Changed from 5% to 100% - entire stake goes to jackpot on losses

// Animation variables
let animationFrames = [];

// Symbol definitions with improved probabilities
// Lower value symbol has higher probability to appear
const symbols = [
    { name: 'lemon', value: 5, cssClass: 'lemon', probability: 20 },
    { name: 'plum', value: 8, cssClass: 'plum', probability: 18 },
    { name: 'cherry', value: 10, cssClass: 'cherry', probability: 17 },
    { name: 'grape', value: 12, cssClass: 'grape', hasInnerHTML: true, probability: 15 },
    { name: 'watermelon', value: 15, cssClass: 'watermelon', probability: 12 },
    { name: 'bell', value: 20, cssClass: 'bell', probability: 10 },
    { name: 'star', value: 50, cssClass: 'star', probability: 5 }  // Reduced probability, increased value
];

// User API for user data - uses fetch to communicate with server
const userAPI = {
    saveUserData: function(userData) {
        // Create a server endpoint URL for saving user data
        const saveUrl = `/save-user?data=${encodeURIComponent(JSON.stringify(userData))}`;
        
        // Make actual server request to save data
        fetch(saveUrl)
            .then(response => {
                console.log('User data saved to server');
            })
            .catch(error => {
                console.error('Error saving user data to server:', error);
                // Fallback to localStorage if server saving fails
                localStorage.setItem('slotMachineUser', JSON.stringify(userData));
            });
            
        // Also save to localStorage as a backup
        localStorage.setItem('slotMachineUser', JSON.stringify(userData));
        console.log('User data saved:', userData);
    },
    
    loadUsersData: function() {
        return new Promise((resolve, reject) => {
            // Create a server endpoint URL for loading user data
            const loadUrl = `/load-users`;
            
            // Try to load from server first
            fetch(loadUrl)
                .then(response => response.json())
                .then(data => {
                    console.log('Users data loaded from server:', data);
                    resolve(data);
                })
                .catch(error => {
                    console.warn('Could not load users from server, using localStorage fallback');
                    // Fallback to localStorage if server loading fails
                    const localData = localStorage.getItem('slotMachineUser');
                    if (localData) {
                        resolve({ 
                            users: { [JSON.parse(localData).username]: JSON.parse(localData) },
                            leaderboard: {
                                topWinner: "",
                                mostWon: 0
                            }
                        });
                    } else {
                        // No data found, return empty data
                        resolve({
                            users: {},
                            leaderboard: {
                                topWinner: "",
                                mostWon: 0
                            }
                        });
                    }
                });
        });
    },
    
    loginUser: function(username) {
        return this.loadUsersData().then(data => {
            // If user exists, load their data
            if (data.users[username]) {
                currentUser = {
                    username: username,
                    totalWon: data.users[username].totalWon || 0,
                    totalWagered: data.users[username].totalWagered || 0
                };
            } else {
                // Create new user
                currentUser = {
                    username: username,
                    totalWon: 0,
                    totalWagered: 0
                };
            }
            
            // Update leaderboard
            leaderboard = data.leaderboard;
            
            // Save user login
            this.saveUserData(currentUser);
            
            // Update display
            updateUserDisplay();
            
            return currentUser;
        });
    }
};

// Server API for jackpot data - uses fetch to communicate with server
const jackpotAPI = {
    // Filename for jackpot data
    jackpotFile: 'jackpot-data.json',
    
    saveJackpotData: function(data) {
        // Create a server endpoint URL for saving jackpot data
        const saveUrl = `/save-jackpot?file=${this.jackpotFile}&data=${encodeURIComponent(JSON.stringify(data))}`;
        
        // Make actual server request to save data
        fetch(saveUrl)
            .then(response => {
                console.log('Jackpot data saved to server');
            })
            .catch(error => {
                console.error('Error saving jackpot data to server:', error);
                // Fallback to localStorage if server saving fails
                localStorage.setItem('slotMachineJackpot', JSON.stringify(data));
            });
            
        // Also save to localStorage as a backup
        localStorage.setItem('slotMachineJackpot', JSON.stringify(data));
        console.log('Jackpot data saved:', data);
    },
    
    loadJackpotData: function() {
        return new Promise((resolve, reject) => {
            // Create a server endpoint URL for loading jackpot data
            const loadUrl = `/load-jackpot?file=${this.jackpotFile}`;
            
            // Try to load from server first
            fetch(loadUrl)
                .then(response => response.json())
                .then(data => {
                    console.log('Jackpot data loaded from server:', data);
                    resolve(data);
                })
                .catch(error => {
                    console.warn('Could not load from server, using localStorage fallback');
                    // Fallback to localStorage if server loading fails
                    const localData = localStorage.getItem('slotMachineJackpot');
                    if (localData) {
                        resolve(JSON.parse(localData));
                    } else {
                        // No data found, return null
                        resolve(null);
                    }
                });
        });
    }
};

// Initialize the game
function initGame() {
    // Create reels
    createReels();
    
    // Add event listeners
    document.getElementById('spin-btn').addEventListener('click', spin);
    document.getElementById('plus-btn').addEventListener('click', increaseStake);
    document.getElementById('minus-btn').addEventListener('click', decreaseStake);
    document.getElementById('info-btn').addEventListener('click', showPaytable);
    document.querySelector('.paytable-close-btn').addEventListener('click', hidePaytable);
    document.getElementById('login-button').addEventListener('click', handleLogin);
    
    // Set up Enter key for login
    document.getElementById('username-input').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Update displays
    updateCredits();
    updateStakeDisplay();
    updateJackpotDisplays();
    
    // Update clock
    updateClock();
    setInterval(updateClock, 60000);
    
    // Load jackpot data from local storage
    loadJackpotFromStorage();
    
    // Load user data
    userAPI.loadUsersData().then(data => {
        leaderboard = data.leaderboard;
        updateUserDisplay();
    });
    
    // Start jackpot growth timer (small automatic growth over time)
    setInterval(growJackpot, 5000);
}

// Function to handle user login
function handleLogin() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput.value.trim();
    
    if (username.length >= 3) {
        userAPI.loginUser(username).then(() => {
            // Hide login modal
            document.getElementById('login-modal').style.display = 'none';
        });
    } else {
        // Show error - username too short
        usernameInput.style.border = '2px solid red';
        setTimeout(() => {
            usernameInput.style.border = '2px solid #fc0';
        }, 2000);
    }
}

// Update user display
function updateUserDisplay() {
    // Update current player
    document.getElementById('current-player').textContent = currentUser.username;
    
    // Update player stats
    document.getElementById('player-total-won').textContent = 
        `$${currentUser.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('player-total-wagered').textContent = 
        `$${currentUser.totalWagered.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Update leaderboard
    if (leaderboard.topWinner) {
        document.getElementById('top-winner').textContent = leaderboard.topWinner;
        document.getElementById('most-won').textContent = 
            `$${leaderboard.mostWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

// Update clock
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    
    // Format to 2 digits
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    document.getElementById('clock').textContent = `${hours}:${minutes}`;
}

// Load jackpot from storage
async function loadJackpotFromStorage() {
    try {
        // Try to load from jackpot API
        const jackpotData = await jackpotAPI.loadJackpotData();
        
        if (jackpotData) {
            // Load jackpot values
            jackpotRoyale = jackpotData.jackpotRoyale || 10000.00;
            lastJackpotWon = jackpotData.lastJackpotWon || 0.00;
            lastJackpotDate = jackpotData.lastJackpotDate || "";
            
            // Update displays
            updateJackpotDisplays();
        } else {
            // If no saved data, set defaults
            resetJackpotDefaults();
        }
    } catch (e) {
        console.error('Error loading jackpot data', e);
        // Reset to defaults if error
        resetJackpotDefaults();
    }
}

// Reset jackpot to default values
function resetJackpotDefaults() {
    jackpotRoyale = 10000.00;
    lastJackpotWon = 0.00;
    lastJackpotDate = "";
    saveJackpotToStorage();
}

// Save jackpot to storage
function saveJackpotToStorage() {
    const jackpotData = {
        jackpotRoyale: jackpotRoyale,
        lastJackpotWon: lastJackpotWon,
        lastJackpotDate: lastJackpotDate,
        lastUpdated: new Date().toISOString()
    };
    
    // Save to jackpot API
    jackpotAPI.saveJackpotData(jackpotData);
}

// Increase jackpot over time (small automatic growth)
function growJackpot() {
    // Only apply tiny automatic growth, main growth comes from spins
    jackpotRoyale += 0.01; // Just 1 cent per increment
    
    // Round to 2 decimal places
    jackpotRoyale = Math.round(jackpotRoyale * 100) / 100;
    
    // Update displays
    updateJackpotDisplays();
    
    // Save to storage
    saveJackpotToStorage();
}

// Update jackpot displays
function updateJackpotDisplays() {
    // Format jackpot values with commas and 2 decimal places
    document.getElementById('main-jackpot').textContent = `$${jackpotRoyale.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Update last jackpot won amount
    const lastJackpotElement = document.getElementById('last-jackpot');
    if (lastJackpotWon > 0) {
        lastJackpotElement.textContent = `$${lastJackpotWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } else {
        lastJackpotElement.textContent = "NONE YET";
    }
    
    // Update jackpot date
    const jackpotDateElement = document.getElementById('jackpot-date');
    if (lastJackpotDate) {
        jackpotDateElement.textContent = lastJackpotDate;
    } else {
        jackpotDateElement.textContent = "NEVER";
    }
}

// Show paytable overlay
function showPaytable() {
    document.getElementById('paytable-overlay').style.display = 'flex';
}

// Hide paytable overlay
function hidePaytable() {
    document.getElementById('paytable-overlay').style.display = 'none';
}

// Increase stake
function increaseStake() {
    if (isSpinning) return;
    
    stake += STAKE_STEP;
    if (stake > MAX_STAKE) stake = MAX_STAKE;
    updateStakeDisplay();
}

// Decrease stake
function decreaseStake() {
    if (isSpinning) return;
    
    stake -= STAKE_STEP;
    if (stake < MIN_STAKE) stake = MIN_STAKE;
    updateStakeDisplay();
}

// Update stake display
function updateStakeDisplay() {
    document.getElementById('stake-display').textContent = `STAKE $${stake.toFixed(2)}`;
}

// Create weighted array of symbols based on probability
function getWeightedSymbols() {
    let weightedSymbols = [];
    symbols.forEach(symbol => {
        for (let j = 0; j < symbol.probability; j++) {
            weightedSymbols.push(symbol);
        }
    });
    return weightedSymbols;
}

// Create a single symbol element
function createSymbolElement(symbol) {
    // Create symbol element
    const symbolElement = document.createElement('div');
    symbolElement.className = 'symbol';
    
    const symbolContent = document.createElement('div');
    symbolContent.className = `symbol-content ${symbol.cssClass}`;
    
    // For grape, add inner elements
    if (symbol.name === 'grape') {
        for (let k = 0; k < 6; k++) {
            const grapeBall = document.createElement('div');
            grapeBall.className = 'grape-ball';
            symbolContent.appendChild(grapeBall);
        }
    }
    
    symbolElement.appendChild(symbolContent);
    return {
        element: symbolElement,
        type: symbol.name,
        value: symbol.value
    };
}

// Create reels with symbols
function createReels() {
    reels = [];
    
    for (let i = 1; i <= 3; i++) {
        // Get reel and strip elements
        const reelElement = document.getElementById(`reel${i}`);
        const stripElement = document.getElementById(`strip${i}`);
        
        // Clear strip
        stripElement.innerHTML = '';
        
        // Create reel data object
        const reel = {
            element: reelElement,
            stripElement: stripElement,
            symbols: [],
            visibleSymbols: [],
            finalSymbols: [],
            position: 0,
            spinSpeed: 0,
            lastUpdate: 0,
            stopping: false,
            stopPosition: 0
        };
        
        // Get weighted symbols array
        const weightedSymbols = getWeightedSymbols();
        
        // Create symbols for this reel
        for (let j = 0; j < SYMBOLS_PER_REEL; j++) {
            // Select a random symbol using weighted probabilities
            const randomIndex = Math.floor(Math.random() * weightedSymbols.length);
            const symbol = weightedSymbols[randomIndex];
            
            // Create and add the symbol
            const symbolData = createSymbolElement(symbol);
            stripElement.appendChild(symbolData.element);
            reel.symbols.push(symbolData);
        }
        
        // Add blank fills to ensure continuous spinning - these are extra invisible symbols
        // that ensure we never see empty spaces
        for (let j = 0; j < 3; j++) {
            // Use the first few symbols again to make a seamless loop
            const originalSymbol = reel.symbols[j];
            const clonedData = createSymbolElement({
                name: originalSymbol.type,
                value: originalSymbol.value,
                cssClass: symbols.find(s => s.name === originalSymbol.type).cssClass,
                hasInnerHTML: symbols.find(s => s.name === originalSymbol.type).hasInnerHTML
            });
            
            stripElement.appendChild(clonedData.element);
            // Note: We don't add these to reel.symbols as they're just visual duplicates
        }
        
        // Position the strip to show the middle symbols initially
        // Make sure it's aligned to symbol boundaries
        stripElement.style.top = `${-1 * SYMBOL_HEIGHT}px`;
        
        // Add to reels array
        reels.push(reel);
    }
}

// Update credit display
function updateCredits() {
    document.getElementById('credit-display').textContent = `CREDIT $${credits.toFixed(2)}`;
}

// Show message
function showMessage(text) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = text;
    
    // Clear message after a delay unless it's "PLACE YOUR BETS!"
    if (text !== "PLACE YOUR BETS!") {
        setTimeout(() => {
            messageElement.textContent = "PLACE YOUR BETS!";
        }, 3000);
    }
}

// Update visible symbols for a reel based on its top position
function updateVisibleSymbols(reel) {
    // Calculate which symbols are visible based on position
    const topPosition = Math.abs(parseFloat(reel.stripElement.style.top) || 0);
    // Make sure we're getting exact positions aligned to symbol boundaries
    const adjustedPosition = Math.round(topPosition / SYMBOL_HEIGHT) * SYMBOL_HEIGHT;
    const topIndex = (adjustedPosition / SYMBOL_HEIGHT) % SYMBOLS_PER_REEL;
    
    console.log(`Reel position: ${topPosition}, Adjusted: ${adjustedPosition}, Top index: ${topIndex}`);
    
    reel.visibleSymbols = [];
    
    // Get the three visible symbols
    for (let i = 0; i < VISIBLE_SYMBOLS; i++) {
        const index = (topIndex + i) % SYMBOLS_PER_REEL;
        if (reel.symbols[index]) {
            reel.visibleSymbols.push(reel.symbols[index]);
        } else {
            console.error(`Invalid symbol index: ${index} (max: ${SYMBOLS_PER_REEL-1})`);
        }
    }
    
    return reel.visibleSymbols;
}

// Helper function to reset the reel strip position when it's gone too far
function resetReelPosition(reel) {
    // Parse the current top position
    let topPosition = parseFloat(reel.stripElement.style.top);
    
    // If we've scrolled more than the total height, reset to keep in bounds
    if (Math.abs(topPosition) > SYMBOLS_PER_REEL * SYMBOL_HEIGHT) {
        // Calculate the equivalent position within the symbol range
        const adjustedPosition = topPosition % (SYMBOLS_PER_REEL * SYMBOL_HEIGHT);
        
        // Apply the new position without transition for seamless loop
        reel.stripElement.style.transition = 'none';
        reel.stripElement.style.top = `${adjustedPosition}px`;
        
        // Force layout reflow
        void reel.stripElement.offsetHeight;
        
        // Restore transition
        reel.stripElement.style.transition = '';
    }
}

// Spin the reels
function spin() {
    // Check if already spinning
    if (isSpinning) return;
    
    // Check if enough credits
    if (credits < stake) {
        showMessage("Not enough credits!");
        return;
    }
    
    // Deduct stake
    credits -= stake;
    updateCredits();
    
    // Track wagered amount for current user
    currentUser.totalWagered += stake;
    userAPI.saveUserData(currentUser);
    updateUserDisplay();
    
    // Set spinning flag
    isSpinning = true;
    
    // Clear win lines
    document.querySelectorAll('.win-line').forEach(line => {
        line.classList.remove('active');
    });
    
    // Remove any highlighted symbols
    document.querySelectorAll('.symbol.highlighted, .symbol.middle-focus').forEach(symbol => {
        symbol.classList.remove('highlighted', 'middle-focus');
    });
    
    // Hide win animation
    document.querySelector('.win-animation').classList.remove('active');
    
    // Show message
    showMessage("Good luck!");
    
    // Setup the spin
    reels.forEach((reel, index) => {
        // Set initial spin speed (slightly different for each reel)
        reel.spinSpeed = 50 + (index * 5);
        reel.lastUpdate = Date.now();
        reel.stopping = false;
        
        // Pre-determine the final symbols for this reel
        // This ensures we can control the outcome for fair gameplay or testing
        const stopIndex = Math.floor(Math.random() * SYMBOLS_PER_REEL);
        
        // Calculate stop position to ensure the chosen symbol is in middle position
        // We want the symbol at stopIndex to end up in the middle position (position 1)
        // The middle position starts at symbol height
        const middleOffset = SYMBOL_HEIGHT;
        
        // Calculate a target position that will place the chosen symbol in the middle
        // The stop position must be a multiple of SYMBOL_HEIGHT to align properly
        let targetTop = -((stopIndex * SYMBOL_HEIGHT) - middleOffset);
        
        // Normalize position to be within a reasonable range and ensure it's aligned to symbol boundaries
        targetTop = Math.round(targetTop / SYMBOL_HEIGHT) * SYMBOL_HEIGHT;
        targetTop = targetTop % (SYMBOLS_PER_REEL * SYMBOL_HEIGHT);
        
        // Ensure target is always negative (moving upward)
        if (targetTop > 0) {
            targetTop -= SYMBOLS_PER_REEL * SYMBOL_HEIGHT;
        }
        
        // Add additional spins to make the animation longer
        // 2-4 complete rotations based on reel index for staggered effect
        const additionalSpins = (2 + index) * SYMBOLS_PER_REEL * SYMBOL_HEIGHT;
        targetTop -= additionalSpins;
        
        // Store the target stop position
        reel.stopPosition = targetTop;
        
        console.log(`Reel ${index+1} stop index: ${stopIndex}, Target position: ${targetTop}`);
        
        // Schedule when to start stopping this reel (staggered stops)
        setTimeout(() => {
            // Start slowing down
            reel.stopping = true;
        }, 1000 + (index * 500)); // Staggered stops - 1s, 1.5s, 2s
    });
    
    // Cancel any existing animation frame
    if (animationFrames.length > 0) {
        animationFrames.forEach(frameId => cancelAnimationFrame(frameId));
        animationFrames = [];
    }
    
    // Start animation
    animateReels();
}

// Animate the reels spinning
function animateReels() {
    let allStopped = true;
    const now = Date.now();
    
    // Update each reel
    reels.forEach((reel, index) => {
        // Calculate delta time since last update
        const deltaTime = now - reel.lastUpdate;
        reel.lastUpdate = now;
        
        // Get current top position
        let topPosition = parseFloat(reel.stripElement.style.top || 0);
        
        // If stopping, gradually decrease speed
        if (reel.stopping) {
            reel.spinSpeed = Math.max(0, reel.spinSpeed - 0.8); // Slightly faster deceleration
            
            // When nearly stopped, move precisely to final position
            if (reel.spinSpeed < 10) {
                // Calculate how close we are to stop position
                const distanceToStop = Math.abs(topPosition - reel.stopPosition);
                
                if (distanceToStop < 5) {
                    reel.stripElement.style.top = `${reel.stopPosition}px`;
                    reel.spinSpeed = 0;
                    const currentPos = Math.abs(reel.stopPosition);
                    const remainder = currentPos % SYMBOL_HEIGHT;
                    if (remainder !== 0) {
                        const adjusted = currentPos - remainder;
                        reel.stripElement.style.top = `-${adjusted}px`;
                    }
                } else {
                    // Slowly move toward stop position
                    const direction = topPosition > reel.stopPosition ? -1 : 1;
                    topPosition += direction * Math.min(distanceToStop, 5);
                    reel.stripElement.style.top = `${topPosition}px`;
                }
            } else {
                // Continue spinning at reducing speed
                topPosition -= reel.spinSpeed * (deltaTime / 16); // Normalize for 60fps
                reel.stripElement.style.top = `${topPosition}px`;
            }
        } else {
            // Normal spinning at constant speed
            topPosition -= reel.spinSpeed * (deltaTime / 16);
            reel.stripElement.style.top = `${topPosition}px`;
        }
        
        // Reset position if scrolled too far to create looping effect
        resetReelPosition(reel);
        
        // Check if still spinning
        if (reel.spinSpeed > 0) {
            allStopped = false;
        } else if (index === reels.length - 1 && allStopped) {
            // All reels stopped, check for wins after a short delay
            setTimeout(checkWins, 300);
            return;
        }
    });
    
    // Continue animation if not all stopped
    if (!allStopped) {
        animationFrames.push(requestAnimationFrame(animateReels));
    }
}

// Check for winning combinations
function checkWins() {
    // Ensure all reels have properly updated their visible symbols
    reels.forEach(reel => {
        updateVisibleSymbols(reel);
    });
    
    // Get visible symbols from each reel
    const visibleSymbols = reels.map(reel => reel.visibleSymbols);
    
    // Debug: log the visible symbols
    console.log("Visible symbols for win checking:");
    visibleSymbols.forEach((reelSymbols, i) => {
        console.log(`Reel ${i+1}:`, reelSymbols.map(s => s.type));
    });
    
    // Check each row for wins
    winAmount = 0;
    const winningLines = [];
    const highlightedSymbols = [];
    
    // Check top row (index 0 in each reel's visibleSymbols array)
    if (visibleSymbols[0][0] && visibleSymbols[1][0] && visibleSymbols[2][0] &&
        visibleSymbols[0][0].type === visibleSymbols[1][0].type && 
        visibleSymbols[1][0].type === visibleSymbols[2][0].type) {
        
        const lineValue = visibleSymbols[0][0].value * stake;
        winAmount += lineValue;
        winningLines.push('top');
        
        // Add symbols to highlight
        highlightedSymbols.push(visibleSymbols[0][0].element);
        highlightedSymbols.push(visibleSymbols[1][0].element);
        highlightedSymbols.push(visibleSymbols[2][0].element);
    }
    
    // Check middle row (index 1 in each reel's visibleSymbols array)
    if (visibleSymbols[0][1] && visibleSymbols[1][1] && visibleSymbols[2][1] &&
        visibleSymbols[0][1].type === visibleSymbols[1][1].type && 
        visibleSymbols[1][1].type === visibleSymbols[2][1].type) {
        
        const lineValue = visibleSymbols[0][1].value * stake;
        winAmount += lineValue;
        winningLines.push('middle');
        
        // Add symbols to highlight
        highlightedSymbols.push(visibleSymbols[0][1].element);
        highlightedSymbols.push(visibleSymbols[1][1].element);
        highlightedSymbols.push(visibleSymbols[2][1].element);
    }
    
    // Check bottom row (index 2 in each reel's visibleSymbols array)
    if (visibleSymbols[0][2] && visibleSymbols[1][2] && visibleSymbols[2][2] &&
        visibleSymbols[0][2].type === visibleSymbols[1][2].type && 
        visibleSymbols[1][2].type === visibleSymbols[2][2].type) {
        
        const lineValue = visibleSymbols[0][2].value * stake;
        winAmount += lineValue;
        winningLines.push('bottom');
        
        // Add symbols to highlight
        highlightedSymbols.push(visibleSymbols[0][2].element);
        highlightedSymbols.push(visibleSymbols[1][2].element);
        highlightedSymbols.push(visibleSymbols[2][2].element);
    }
    
    // Highlight winning symbols
    highlightedSymbols.forEach(symbol => {
        if (symbol) symbol.classList.add('highlighted');
    });
    
    // Show winning lines
    winningLines.forEach(line => {
        document.querySelector(`.win-line.${line}`).classList.add('active');
    });
    
    // Check for jackpot
    const jackpotWin = checkForJackpot(visibleSymbols);
    
    // Show win animation if won
    if (winAmount > 0 || jackpotWin) {
        document.querySelector('.win-animation').classList.add('active');
        if (jackpotWin) {
            // Update user stats for jackpot win
            currentUser.totalWon += jackpotRoyale;
            userAPI.saveUserData(currentUser);
            updateUserDisplay();
            
            handleJackpotWin();
        } else {
            // Update user stats for regular win
            currentUser.totalWon += winAmount;
            userAPI.saveUserData(currentUser);
            updateUserDisplay();
            
            credits += winAmount;
            updateCredits();
            showMessage(`WIN ${winAmount.toFixed(2)}!`);
        }
        if (winAmount >= 10 || jackpotWin) {
            createWinParticles();
        }
    } else {
        jackpotRoyale += stake;
        jackpotRoyale = parseFloat(jackpotRoyale.toFixed(2));
        updateJackpotDisplays();
        saveJackpotToStorage();
        showMessage("Try again!");
    }
    
    // Reset spinning flag
    isSpinning = false;
}

// Handle jackpot win
function handleJackpotWin() {
    // Add jackpot to credits
    credits += jackpotRoyale;
    
    // Show message
    showMessage(`JACKPOT WIN ${jackpotRoyale.toFixed(2)}!`);
    
    // Create particles for jackpot win
    createWinParticles();
    
    // Show win animation
    document.querySelector('.win-animation').classList.add('active');
    
    // Update jackpot history data
    lastJackpotWon = jackpotRoyale;
    
    // Format the current date (MM/DD/YYYY)
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear();
    lastJackpotDate = `${month}/${day}/${year}`;
    
    // Reset jackpot (to starting amount)
    jackpotRoyale = 10000.00;
    
    // Update displays
    updateCredits();
    updateJackpotDisplays();
    
    // Save to storage
    saveJackpotToStorage();
}

// Check for special prize combinations
function checkForSpecialPrizes(visibleSymbols) {
    // Count occurrences of each symbol type
    const symbolCounts = {};
    
    visibleSymbols.forEach(reel => {
        reel.forEach(symbol => {
            symbolCounts[symbol.type] = (symbolCounts[symbol.type] || 0) + 1;
        });
    });
    
    // Check for specific combinations
    if (symbolCounts['star'] >= 7) return 1000 * stake; // Grand prize
    if (symbolCounts['star'] >= 5) return 150 * stake;  // Major prize
    if (symbolCounts['star'] >= 3) return 50 * stake;   // Minor prize
    if (symbolCounts['bell'] >= 6) return 100 * stake;  // Bell bonus
    
    // Check for mixed fruit combination (at least 7 fruit symbols)
    const fruitCount = (symbolCounts['cherry'] || 0) + 
                       (symbolCounts['watermelon'] || 0) + 
                       (symbolCounts['grape'] || 0) + 
                       (symbolCounts['lemon'] || 0) + 
                       (symbolCounts['plum'] || 0);
    
    if (fruitCount >= 7) return 25 * stake; // Mini prize
    
    return 0;
}

// Create particles for win animation
function createWinParticles() {
    const slotMachine = document.getElementById('slot-machine');
    
    // Create multiple particles
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random position, color and size
        const size = Math.random() * 10 + 5;
        const colors = ['#fc0', '#f70', '#0f0', '#09f', '#f0f'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.backgroundColor = color;
        
        // Starting position
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        particle.style.left = `${x}%`;
        particle.style.top = `${y}%`;
        
        // Animation
        const tx = (Math.random() - 0.5) * 200;
        const ty = (Math.random() - 0.5) * 200;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        particle.style.animation = `particle-animation ${Math.random() * 1 + 1}s forwards`;
        
        // Add to container
        slotMachine.appendChild(particle);
        
        // Remove after animation
        setTimeout(() => {
            particle.remove();
        }, 2000);
    }
}

// Initialize game on load
window.addEventListener('load', initGame);