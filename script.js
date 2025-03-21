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
let credits = 100; // Starting credit - always $100 when joining
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
    totalWon: 0,      // Total amount won (for leaderboard)
    totalWagered: 0,  // Total amount wagered
    bankroll: 0       // Net total (wins - losses)
};

let leaderboard = {
    topWinner: "",
    mostWon: 0
};


let customSymbols = {
    // Will store the custom image data URLs
    // Format: { symbolName: dataURL }
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
const JACKPOT_INCREMENT_PERCENT = 100; // Full stake goes to jackpot on losses

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
    // Store user ID once logged in
    userId: null,
    uniqueIdentifier: null,
    
    saveUserData: function(userData) {
        // Clone userData to avoid modifying the original object
        const userDataToSave = JSON.parse(JSON.stringify(userData));
        
        // Round monetary values to 2 decimal places
        if (typeof userDataToSave.totalWon === 'number') {
            userDataToSave.totalWon = Math.round(userDataToSave.totalWon * 100) / 100;
        }
        
        if (typeof userDataToSave.totalWagered === 'number') {
            userDataToSave.totalWagered = Math.round(userDataToSave.totalWagered * 100) / 100;
        }
        
        if (typeof userDataToSave.bankroll === 'number') {
            userDataToSave.bankroll = Math.round(userDataToSave.bankroll * 100) / 100;
        }
        
        console.log('Saving user data to server:', userDataToSave);
        
        // Create a server endpoint URL for saving user data
        const saveUrl = `/save-user?data=${encodeURIComponent(JSON.stringify(userDataToSave))}`;
        
        // Make actual server request to save data
        return fetch(saveUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                // If server returns an error status, throw an error with details
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                }).catch(jsonError => {
                    // If error response isn't valid JSON
                    throw new Error(`Server error: ${response.status} - ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(result => {
            console.log('User data saved to server:', result);
            
            if (result.success) {
                // Update stored user ID
                this.userId = result.data.id;
                this.uniqueIdentifier = result.data.uniqueIdentifier;
                
                // Update leaderboard if provided
                if (result.leaderboard) {
                    leaderboard = result.leaderboard;
                }
                
                // Update custom symbols if provided
                if (result.data.customSymbols) {
                    customSymbols = result.data.customSymbols;
                    applyCustomSymbols();
                }
                
                // Update local data with values returned from server
                if (result.data) {
                    if (typeof result.data.totalWon === 'number') {
                        userData.totalWon = result.data.totalWon;
                    }
                    if (typeof result.data.totalWagered === 'number') {
                        userData.totalWagered = result.data.totalWagered;
                    }
                    if (typeof result.data.bankroll === 'number') {
                        userData.bankroll = result.data.bankroll;
                    }
                }
            } else {
                console.warn('Server reported failure:', result.error);
            }
            
            return result;
        })
        .catch(error => {
            console.error('Error saving user data to server:', error);
            
            // Show a user-friendly message
            showMessage("Connection error");
            
            // Fallback to localStorage if server saving fails
            try {
                localStorage.setItem('slotMachineUser', JSON.stringify(userDataToSave));
                console.log('User data saved to localStorage as fallback');
            } catch (storageError) {
                console.error('Failed to save to localStorage:', storageError);
            }
            
            // Return a valid response format with error info
            return { 
                success: false, 
                error: error.message, 
                usingLocalStorage: true,
                data: userDataToSave  // Return the original data
            };
        });
    },
    
    loadUsersData: function() {
        return new Promise((resolve, reject) => {
            // Create a server endpoint URL for loading user data
            const loadUrl = `/load-users`;
            
            // Try to load from server first
            fetch(loadUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Users data loaded from server:', data);
                    
                    // Store the unique identifier
                    this.uniqueIdentifier = data.uniqueIdentifier;
                    
                    resolve(data);
                })
                .catch(error => {
                    console.warn('Could not load users from server, using localStorage fallback:', error);
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
                const userData = data.users[username];
                
                // Round values immediately when loading from server
                const totalWon = userData.totalWon ? Math.round(userData.totalWon * 100) / 100 : 0;
                const totalWagered = userData.totalWagered ? Math.round(userData.totalWagered * 100) / 100 : 0;
                const bankroll = userData.bankroll ? Math.round(userData.bankroll * 100) / 100 : 0;
                
                console.log(`Loading user data - totalWon: ${totalWon.toFixed(2)}, totalWagered: ${totalWagered.toFixed(2)}`);
                
                currentUser = {
                    username: username,
                    totalWon: totalWon,
                    totalWagered: totalWagered,
                    bankroll: bankroll
                };
                
                // Set user ID if available
                if (userData.id) {
                    this.userId = userData.id;
                }
            } else {
                // Create new user
                currentUser = {
                    username: username,
                    totalWon: 0,
                    totalWagered: 0,
                    bankroll: 0 // Initialize bankroll at 0
                };
            }
            
            // Update leaderboard
            leaderboard = data.leaderboard;
            
            // Save user login and get updated data
            return this.saveUserData(currentUser).then(result => {
                if (result.success) {
                    // ALWAYS reset credits to $100 for a new session
                    credits = 100;
                    
                    // Ensure the values from the server are properly rounded
                    if (result.data) {
                        if (typeof result.data.totalWon === 'number') {
                            currentUser.totalWon = Math.round(result.data.totalWon * 100) / 100;
                        }
                        if (typeof result.data.totalWagered === 'number') {
                            currentUser.totalWagered = Math.round(result.data.totalWagered * 100) / 100;
                        }
                        if (typeof result.data.bankroll === 'number') {
                            currentUser.bankroll = Math.round(result.data.bankroll * 100) / 100;
                        }
                    }
                    
                    // Update display
                    updateUserDisplay();
                    updateCredits();
                }
                
                return currentUser;
            });
        });
    },
    
    // Load custom symbols for current user
    loadCustomSymbols: function() {
        // Only load if we have a user ID
        if (!this.userId) {
            return Promise.resolve({});
        }
        
        return fetch(`/load-custom-symbols?userId=${this.userId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    customSymbols = data.customSymbols || {};
                    applyCustomSymbols();
                    return customSymbols;
                }
                return {};
            })
            .catch(error => {
                console.error('Error loading custom symbols:', error);
                return {};
            });
    },
    
    // Save a custom symbol
    saveCustomSymbol: function(symbolName, imageData) {
        // Only save if we have a user ID
        if (!this.userId) {
            return Promise.resolve(false);
        }
        
        const symbolData = {
            userId: this.userId,
            symbolName: symbolName,
            imageData: imageData
        };
        
        // Save to localStorage as a backup immediately
        try {
            const storageKey = `symbol_${symbolName}`;
            localStorage.setItem(storageKey, imageData);
            console.log(`Backed up ${symbolName} to localStorage`);
        } catch (storageError) {
            console.warn('Failed to backup to localStorage:', storageError);
        }
        
        // Define a function to attempt the save with retries
        const attemptSave = (retryCount = 0) => {
            return fetch('/save-custom-symbol', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(symbolData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Symbol ${symbolName} saved successfully to server`);
                return data.success || false;
            })
            .catch(error => {
                console.error(`Error saving custom symbol (attempt ${retryCount + 1}):`, error);
                
                // If we haven't tried too many times, retry
                if (retryCount < 2) {
                    console.log(`Retrying symbol save (attempt ${retryCount + 1})...`);
                    return new Promise(resolve => {
                        // Wait a bit before retrying
                        setTimeout(() => {
                            resolve(attemptSave(retryCount + 1));
                        }, 1000); // 1 second delay
                    });
                }
                
                // If all retries failed, we already saved to localStorage
                // so we can consider it a partial success
                return true;
            });
        };
        
        return attemptSave();
    },
    
    // Delete a custom symbol
    deleteCustomSymbol: function(symbolName) {
        // Only delete if we have a user ID
        if (!this.userId) {
            return Promise.resolve(false);
        }
        
        return fetch(`/delete-custom-symbol?userId=${this.userId}&symbolName=${symbolName}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                return data.success || false;
            })
            .catch(error => {
                console.error('Error deleting custom symbol:', error);
                return false;
            });
    },
    
    // Record a spin
    recordSpin: function(spinData) {
        // Only record if we have a user ID
        if (!this.userId) {
            return Promise.resolve(false);
        }
        
        // Add user ID to spin data
        spinData.userId = this.userId;
        
        return fetch(`/record-spin?data=${encodeURIComponent(JSON.stringify(spinData))}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                return data.success || false;
            })
            .catch(error => {
                console.error('Error recording spin:', error);
                return false;
            });
    }
};

// Server API for jackpot data - uses fetch to communicate with server
const jackpotAPI = {
    // Lock mechanism to prevent multiple updates
    lockPending: false,
    
    saveJackpotData: function(data) {
        // Prevent multiple simultaneous updates
        if (this.lockPending) {
            console.log('Jackpot update already in progress, will retry in 500ms');
            setTimeout(() => this.saveJackpotData(data), 500);
            return Promise.resolve(false);
        }
        
        this.lockPending = true;
        console.log('Saving jackpot data to server:', data);
        
        // Create a server endpoint URL for saving jackpot data
        const saveUrl = `/save-jackpot?data=${encodeURIComponent(JSON.stringify(data))}`;
        
        // Make actual server request to save data
        return fetch(saveUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(result => {
                console.log('Jackpot data saved to server, response:', result);
                this.lockPending = false;
                
                if (result.success && result.data) {
                    // Update local variables with server data
                    const serverJackpot = parseFloat(result.data.jackpotRoyale);
                    if (!isNaN(serverJackpot)) {
                        jackpotRoyale = serverJackpot;
                        console.log('Updated local jackpot value to match server:', jackpotRoyale.toFixed(2));
                    } else {
                        console.error('Invalid jackpot value from server:', result.data.jackpotRoyale);
                    }
                    
                    lastJackpotWon = parseFloat(result.data.lastJackpotWon) || 0;
                    lastJackpotDate = result.data.lastJackpotDate || "";
                    
                    // Update displays
                    updateJackpotDisplays();
                }
                
                return result.success || false;
            })
            .catch(error => {
                console.error('Error saving jackpot data to server:', error);
                this.lockPending = false;
                return false;
            });
    },
    
    loadJackpotData: function() {
        console.log('Loading jackpot data from server...');
        
        return fetch('/load-jackpot')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Jackpot data loaded from server:', data);
                
                // Ensure numeric values
                if (data && data.jackpotRoyale) {
                    data.jackpotRoyale = parseFloat(data.jackpotRoyale);
                    data.lastJackpotWon = parseFloat(data.lastJackpotWon || 0);
                }
                
                return data;
            })
            .catch(error => {
                console.warn('Could not load jackpot from server:', error);
                return {
                    jackpotRoyale: 10000.00,
                    lastJackpotWon: 0.00,
                    lastJackpotDate: "",
                    lastUpdated: new Date().toISOString()
                };
            });
    }
};

// Initialize the game
function initGame() {
    // Create reels
    createReels();
    initCustomSymbolsSupport();
    
    
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
    
    // Initialize symbol customizer
    initSymbolCustomizer();

    // Update clock
    updateClock();
    setInterval(updateClock, 60000);
    
    // Load jackpot data from database
    loadJackpotFromStorage();
    
    // Show login modal immediately
    document.getElementById('login-modal').style.display = 'flex';
    
    // Start jackpot refresh timer
    setInterval(refreshJackpotFromServer, 5000);
    
    console.log('Game initialized successfully');
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
    // Validate and round totalWon
    let totalWon = 0;
    if (typeof currentUser.totalWon === 'number' && !isNaN(currentUser.totalWon)) {
        totalWon = Math.round(currentUser.totalWon * 100) / 100;
    }
    
    // Validate and round totalWagered
    let totalWagered = 0;
    if (typeof currentUser.totalWagered === 'number' && !isNaN(currentUser.totalWagered)) {
        totalWagered = Math.round(currentUser.totalWagered * 100) / 100;
    }
    
    // Log current values for debugging
    console.log(`Displaying user stats - totalWon: ${totalWon.toFixed(2)}, totalWagered: ${totalWagered.toFixed(2)}`);
    
    // Update current player
    document.getElementById('current-player').textContent = currentUser.username;
    
    // Use toFixed(2) to ensure consistent 2 decimal place display
    document.getElementById('player-total-won').textContent = `$${totalWon.toFixed(2)}`;
    document.getElementById('player-total-wagered').textContent = `$${totalWagered.toFixed(2)}`;
    
    // Update leaderboard with similar handling
    if (leaderboard.topWinner) {
        let mostWon = 0;
        if (typeof leaderboard.mostWon === 'number' && !isNaN(leaderboard.mostWon)) {
            mostWon = Math.round(leaderboard.mostWon * 100) / 100;
        }
        
        document.getElementById('top-winner').textContent = leaderboard.topWinner;
        document.getElementById('most-won').textContent = `$${mostWon.toFixed(2)}`;
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
        console.log('Loading jackpot data from database...');
        // Try to load from jackpot API
        const jackpotData = await jackpotAPI.loadJackpotData();
        
        if (jackpotData && typeof jackpotData === 'object') {
            console.log('Jackpot data loaded successfully:', jackpotData);
            
            // Load jackpot values with validation
            jackpotRoyale = typeof jackpotData.jackpotRoyale === 'number' && !isNaN(jackpotData.jackpotRoyale) 
                ? jackpotData.jackpotRoyale 
                : 10000.00;
                
            lastJackpotWon = typeof jackpotData.lastJackpotWon === 'number' && !isNaN(jackpotData.lastJackpotWon)
                ? jackpotData.lastJackpotWon 
                : 0.00;
                
            lastJackpotDate = typeof jackpotData.lastJackpotDate === 'string'
                ? jackpotData.lastJackpotDate 
                : "";
            
            // Update displays
            updateJackpotDisplays();
        } else {
            console.warn('Invalid jackpot data received:', jackpotData);
            // If no saved data or invalid data, set defaults
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
        lastUpdated: new Date().toISOString() // Add timestamp for better tracking
    };
    
    console.log('Saving jackpot to storage:', jackpotData);
    
    // Return the promise to allow chaining and error handling
    return jackpotAPI.saveJackpotData(jackpotData);
}

function refreshJackpotFromServer() {
    // Don't refresh if currently spinning or handling a win/loss
    if (isSpinning) {
        return;
    }
    
    // Use a flag to prevent jackpot refresh during the entire spin/win evaluation cycle
    if (window.jackpotUpdateInProgress) {
        return;
    }
    
    // Store the current jackpot value to compare later
    const currentJackpot = jackpotRoyale;
    
    jackpotAPI.loadJackpotData()
        .then(data => {
            // Convert server jackpot to number for proper comparison
            const serverJackpot = parseFloat(data.jackpotRoyale);
            
            if (data && !isNaN(serverJackpot)) {
                console.log('Comparing jackpots - Local:', currentJackpot.toFixed(2), 'Server:', serverJackpot.toFixed(2));
                
                // Only update if the server value is higher than our local value
                // This prevents overwriting our local increments after losing spins
                if (serverJackpot > currentJackpot) {
                    console.log('Updating jackpot from server:', currentJackpot.toFixed(2), '->', serverJackpot.toFixed(2));
                    jackpotRoyale = serverJackpot;
                    lastJackpotWon = parseFloat(data.lastJackpotWon || 0);
                    lastJackpotDate = data.lastJackpotDate || "";
                    updateJackpotDisplays();
                } else if (Math.abs(currentJackpot - serverJackpot) > 1000) {
                    // If there's a large discrepancy (more than $1000), update the server with our value
                    console.log('Large jackpot discrepancy detected. Updating server with local value:', 
                               currentJackpot.toFixed(2), 'vs server:', serverJackpot.toFixed(2));
                    saveJackpotToStorage();
                }
            } else {
                console.error('Invalid jackpot value from server:', data.jackpotRoyale);
            }
        })
        .catch(error => {
            console.warn('Error refreshing jackpot data:', error);
        });
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
            stopPosition: 0,
            clonedSymbols: [] // Add an array to track cloned symbols
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
            // Now also track these cloned symbols
            reel.clonedSymbols.push(clonedData);
        }
        
        // Position the strip to show the middle symbols initially
        // Make sure it's aligned to symbol boundaries
        stripElement.style.top = `${-1 * SYMBOL_HEIGHT}px`;
        
        // Add to reels array
        reels.push(reel);
    }

    // Apply custom symbols after creating reels
    if (Object.keys(customSymbols).length > 0) {
        applyCustomSymbols();
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
        
        // Reapply custom symbols after position reset
        if (Object.keys(customSymbols).length > 0) {
            ensureCustomSymbolsApplied();
        }
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
    
    // Set flags to prevent jackpot updates during spin
    isSpinning = true;
    window.jackpotUpdateInProgress = true;
    
    // Deduct stake
    credits -= stake;
    updateCredits();
    
    // Track wagered amount for current user
    currentUser.totalWagered += stake;
    // Add this line to ensure proper rounding to 2 decimal places
    currentUser.totalWagered = Math.round(currentUser.totalWagered * 100) / 100;
    currentUser.bankroll -= stake; // Deduct from bankroll
    // Also round the bankroll
    currentUser.bankroll = Math.round(currentUser.bankroll * 100) / 100;

    userAPI.saveUserData(currentUser);
    updateUserDisplay();
    
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
        
        // Schedule when to start stopping this reel (staggered stops)
        setTimeout(() => {
            // Start slowing down
            reel.stopping = true;

            if (Object.keys(customSymbols).length > 0) {
                ensureCustomSymbolsApplied();
            }

        }, 1000 + (index * 500)); // Staggered stops - 1s, 1.5s, 2s
    });
    
    // Cancel any existing animation frame
    if (animationFrames.length > 0) {
        animationFrames.forEach(frameId => cancelAnimationFrame(frameId));
        animationFrames = [];
    }
    applyCustomSymbols();
    // Start animation
    animateReels();

    
}

function initCustomSymbolsSupport() {
    // Load custom symbols
    loadCustomSymbols();
    
    // Setup observer to keep symbols applied during animations
    if (!window.symbolObserver) {
        window.symbolObserver = setupCustomSymbolObserver();
    }
}


// Animate the reels spinning
function animateReels() {
    let allStopped = true;
    const now = Date.now();

    if (Object.keys(customSymbols).length > 0) {
        ensureCustomSymbolsApplied();
    }
    
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
            setTimeout(() => {
                // Apply custom symbols before checking wins
                ensureCustomSymbolsApplied();
                checkWins();
            }, 300);
            return;
        }
    });
    
    // Periodically ensure custom symbols are applied even during animation
    // Use a timestamp-based approach to limit how often this runs
    if (now % 200 < 20) { // Run roughly every 200ms
        ensureCustomSymbolsApplied();
    }
    
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
    
    // Prepare spin data for recording
    const spinData = {
        stake: stake,
        winAmount: winAmount,
        isJackpot: jackpotWin,
        reel1Symbols: visibleSymbols[0].map(s => s.type),
        reel2Symbols: visibleSymbols[1].map(s => s.type),
        reel3Symbols: visibleSymbols[2].map(s => s.type)
    };
    
    // Show win animation if won
    if (winAmount > 0 || jackpotWin) {
        document.querySelector('.win-animation').classList.add('active');
        if (jackpotWin) {
            // Update user stats for jackpot win
            const jackpotAmount = jackpotRoyale;
            
            // Log the winnings update
            console.log(`Jackpot Win: Adding ${jackpotAmount.toFixed(2)} to total won (before: ${currentUser.totalWon.toFixed(2)})`);
            
            // Update total won with the jackpot amount
            currentUser.totalWon += jackpotAmount;
            // Ensure proper rounding
            currentUser.totalWon = Math.round(currentUser.totalWon * 100) / 100;
            
            console.log(`Total won after jackpot: ${currentUser.totalWon.toFixed(2)}`);
            
            // Update bankroll
            currentUser.bankroll += jackpotAmount;
            // Ensure proper rounding for bankroll too
            currentUser.bankroll = Math.round(currentUser.bankroll * 100) / 100;
            
            // Save user data
            userAPI.saveUserData(currentUser);
            updateUserDisplay();
            
            // Handle jackpot win (will add to credits)
            handleJackpotWin();
            
            // Record the jackpot spin
            spinData.winAmount = jackpotAmount;
        } else {
            // For regular wins, take money from the jackpot
            // Cap the win amount to not exceed the jackpot
            const actualWinAmount = Math.min(winAmount, jackpotRoyale);
            
            // Deduct from jackpot
            jackpotRoyale -= actualWinAmount;
            jackpotRoyale = Math.max(0, jackpotRoyale); // Ensure jackpot doesn't go negative
            
            // Round to 2 decimal places
            jackpotRoyale = Math.round(jackpotRoyale * 100) / 100;
            
            // Log the winnings update
            console.log(`Regular Win: Adding ${actualWinAmount.toFixed(2)} to total won (before: ${currentUser.totalWon.toFixed(2)})`);
            
            // Update user stats for regular win
            currentUser.totalWon += actualWinAmount;
            // Ensure proper rounding to exactly 2 decimal places
            currentUser.totalWon = Math.round(currentUser.totalWon * 100) / 100;
            
            console.log(`Total won after update: ${currentUser.totalWon.toFixed(2)}`);
            
            currentUser.bankroll += actualWinAmount; // Add to bankroll
            // Ensure proper rounding for bankroll too
            currentUser.bankroll = Math.round(currentUser.bankroll * 100) / 100;
            
            // Save updated data
            userAPI.saveUserData(currentUser);
            updateUserDisplay();
            
            // Add to credits
            credits += actualWinAmount;
            updateCredits();
            
            // Update jackpot display
            updateJackpotDisplays();
            saveJackpotToStorage();
            
            showMessage(`WIN $${actualWinAmount.toFixed(2)}!`);
            
            // Update the actual win amount in spin data
            spinData.winAmount = actualWinAmount;
        }
        
        // Create particles for significant wins
        if (winAmount >= 10 || jackpotWin) {
            createWinParticles();
        }
    } else {
        // No win - add stake to jackpot
        const incrementAmount = stake * (JACKPOT_INCREMENT_PERCENT / 100);
        console.log(`No win - adding ${incrementAmount.toFixed(2)} to jackpot (${stake} * ${JACKPOT_INCREMENT_PERCENT}%)`);
    
        // Get previous jackpot for logging
        const previousJackpot = jackpotRoyale;
        
        // Add to jackpot
        jackpotRoyale += incrementAmount;
        jackpotRoyale = Math.round(jackpotRoyale * 100) / 100; // Round to 2 decimal places
        
        console.log(`Jackpot updated: ${previousJackpot.toFixed(2)} -> ${jackpotRoyale.toFixed(2)}`);
    
        // Update display first
        updateJackpotDisplays();
        
        // Save immediately to prevent race conditions
        saveJackpotToStorage().then(() => {
            console.log('Jackpot updated after loss:', jackpotRoyale.toFixed(2));
        }).catch(err => {
            console.error('Failed to update jackpot after loss:', err);
        });
        
        showMessage("Try again!");
    }

    
    // Record the spin in database
    userAPI.recordSpin(spinData).then(success => {
        if (success) {
            console.log('Spin recorded successfully');
        }
        
        // Only reset the flags after database operations complete
        // This ensures the jackpot refresh won't happen until everything is done
        isSpinning = false;
        window.jackpotUpdateInProgress = false;
    }).catch(error => {
        console.error('Error recording spin:', error);
        // Even if there's an error, we need to reset flags
        isSpinning = false;
        window.jackpotUpdateInProgress = false;
    });

    if (Object.keys(customSymbols).length > 0) {
        applyCustomSymbols();
    }
    
}

let lastSymbolApplyTime = 0;
const SYMBOL_APPLY_THROTTLE = 100; // ms minimum between applications

function ensureCustomSymbolsApplied() {
    // Only proceed if we have custom symbols defined
    if (Object.keys(customSymbols).length === 0) return;
    
    // Throttle applications to avoid performance issues
    const now = Date.now();
    if (now - lastSymbolApplyTime < SYMBOL_APPLY_THROTTLE) return;
    lastSymbolApplyTime = now;
    
    // Apply to currently visible symbols only
    reels.forEach((reel, reelIndex) => {
        // Get the visible symbols for this reel
        updateVisibleSymbols(reel);
        
        // Only apply to visible symbols for performance
        reel.visibleSymbols.forEach(symbolData => {
            if (!symbolData || !symbolData.element) return;
            
            const symbolType = symbolData.type;
            const symbolElement = symbolData.element;
            const symbolContent = symbolElement.querySelector(`.symbol-content`);
            
            if (!symbolContent) return;
            
            // If this symbol has a custom image, ensure it's applied
            if (customSymbols[symbolType]) {
                // Apply custom image if needed
                if (!symbolContent.classList.contains('custom') || 
                    !symbolContent.style.backgroundImage.includes('data:image')) {
                    
                    symbolContent.style.backgroundImage = `url('${customSymbols[symbolType]}')`;
                    symbolContent.classList.add('custom');
                    
                    // Hide grape balls if this is a grape symbol
                    if (symbolType === 'grape') {
                        const grapeBalls = symbolContent.querySelectorAll('.grape-ball');
                        grapeBalls.forEach(ball => {
                            ball.style.display = 'none';
                        });
                    }
                }
            }
        });
    });
}

function setupCustomSymbolObserver() {
    // Create a MutationObserver to watch for changes to the reels
    const observer = new MutationObserver((mutations) => {
        let shouldApplySymbols = false;
        
        mutations.forEach(mutation => {
            // Check if the style.top property has changed significantly
            if (mutation.type === 'attributes' && 
                mutation.attributeName === 'style' && 
                mutation.target.classList.contains('reel-strip')) {
                
                shouldApplySymbols = true;
            }
        });
        
        if (shouldApplySymbols && Object.keys(customSymbols).length > 0) {
            // Apply custom symbols after a slight delay to ensure DOM is settled
            setTimeout(applyCustomSymbols, 50);
        }
    });
    
    // Observe all reel strips
    reels.forEach(reel => {
        observer.observe(reel.stripElement, { 
            attributes: true,
            attributeFilter: ['style']
        });
    });
    
    return observer;
}


// Handle jackpot win
function handleJackpotWin() {
    const jackpotAmount = jackpotRoyale;
    
    // Add jackpot to credits
    credits += jackpotAmount;
    
    // Show message
    showMessage(`JACKPOT WIN $${jackpotAmount.toFixed(2)}!`);
    
    // Create particles for jackpot win
    createWinParticles();
    
    // Show win animation
    document.querySelector('.win-animation').classList.add('active');
    
    // Update jackpot history data
    lastJackpotWon = jackpotAmount;
    
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
    
    // Save to database
    saveJackpotToStorage();
    
    // Check if this player should be the new leaderboard champion
    if (jackpotAmount > leaderboard.mostWon) {
        leaderboard.topWinner = currentUser.username;
        leaderboard.mostWon = jackpotAmount;
        
        // This will be saved when user data is saved
        userAPI.saveUserData(currentUser);
    }
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


// Initialize symbol customizer
function initSymbolCustomizer() {
    // Get the customizer button (first button)
    const customizerBtn = document.querySelector('#controls .btn:first-child');
    
    // Add event listener to open customizer
    customizerBtn.addEventListener('click', showSymbolCustomizer);
    
    // Add event listeners for the symbol customizer modal
    document.getElementById('close-customizer-btn').addEventListener('click', hideSymbolCustomizer);
    document.getElementById('save-symbols-btn').addEventListener('click', saveCustomSymbols);
    
    // Add event listeners for file inputs
    document.querySelectorAll('.symbol-file').forEach(input => {
        input.addEventListener('change', handleSymbolUpload);
    });
    
    // Add event listeners for reset buttons
    document.querySelectorAll('.reset-btn').forEach(button => {
        button.addEventListener('click', resetSymbol);
    });
    
    // Load any previously saved custom symbols
    loadCustomSymbols();
}

// Show symbol customizer modal
function showSymbolCustomizer() {
    if (isSpinning) return; // Don't show if reels are spinning
    
    console.log('Opening symbol customizer, current symbols:', Object.keys(customSymbols));
    
    // First load the latest custom symbols
    const loadSymbols = userAPI.userId ? userAPI.loadCustomSymbols() : Promise.resolve(customSymbols);
    
    loadSymbols.then(serverSymbols => {
        // Update customSymbols object with any new server symbols
        if (serverSymbols && typeof serverSymbols === 'object') {
            // Merge with existing localStorage symbols
            for (const symbolType in serverSymbols) {
                if (!customSymbols[symbolType]) {
                    customSymbols[symbolType] = serverSymbols[symbolType];
                }
            }
        }
        
        // Update the previews in the customizer
        updateSymbolPreviews();
        
        // Show the modal
        document.getElementById('symbol-customizer-modal').style.display = 'flex';
    }).catch(error => {
        console.warn('Error loading custom symbols for customizer:', error);
        
        // Still update previews with what we have
        updateSymbolPreviews();
        
        // Show the modal
        document.getElementById('symbol-customizer-modal').style.display = 'flex';
    });
}

function updateSymbolPreviews() {
    console.log('Updating symbol previews with current symbols:', Object.keys(customSymbols));
    
    // For each symbol type in the customizer
    document.querySelectorAll('.symbol-row').forEach(row => {
        const symbolType = row.querySelector('.symbol-file').dataset.symbol;
        const previewContent = row.querySelector('.symbol-content');
        
        // Reset preview styling first
        previewContent.style.backgroundImage = '';
        previewContent.classList.remove('custom');
        
        // Check if there's a custom symbol for this type
        if (customSymbols[symbolType]) {
            // Apply custom image to preview
            previewContent.style.backgroundImage = `url('${customSymbols[symbolType]}')`;
            previewContent.classList.add('custom');
            
            // If it's a grape symbol, hide grape balls
            if (symbolType === 'grape') {
                const grapeBalls = previewContent.querySelectorAll('.grape-ball');
                grapeBalls.forEach(ball => {
                    ball.style.display = 'none';
                });
            }
        } else {
            // Reset to default styling
            previewContent.style.backgroundImage = '';
            previewContent.classList.remove('custom');
            
            // If it's a grape symbol, show grape balls
            if (symbolType === 'grape') {
                const grapeBalls = previewContent.querySelectorAll('.grape-ball');
                grapeBalls.forEach(ball => {
                    ball.style.display = '';
                });
            }
        }
    });
}

// Hide symbol customizer modal
function hideSymbolCustomizer() {
    document.getElementById('symbol-customizer-modal').style.display = 'none';
}


// Handle symbol image upload
function handleSymbolUpload(event) {
    const file = event.target.files[0];
    const symbolType = event.target.dataset.symbol;
    
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }
    
    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('Image file size must be less than 2MB');
        return;
    }
    
    // Create a FileReader to read the image
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const dataURL = e.target.result;
        
        // Store the custom symbol locally
        customSymbols[symbolType] = dataURL;
        
        // Update the preview
        const previewElement = event.target.closest('.symbol-row').querySelector('.symbol-content');
        previewElement.style.backgroundImage = `url('${dataURL}')`;
        previewElement.classList.add('custom');
    };
    
    reader.readAsDataURL(file);
}


// Reset a symbol to default
function resetSymbol(event) {
    const symbolType = event.target.dataset.symbol;
    console.log(`Resetting symbol: ${symbolType}`);
    
    // Remove from customSymbols object
    delete customSymbols[symbolType];
    
    // Remove from localStorage
    try {
        localStorage.removeItem(`symbol_${symbolType}`);
        
        // Update the full collection in localStorage
        localStorage.setItem('slotMachineCustomSymbols', JSON.stringify(customSymbols));
    } catch (error) {
        console.warn('Failed to update localStorage after reset:', error);
    }
    
    // Update the preview in the modal
    const previewElement = event.target.closest('.symbol-row').querySelector('.symbol-content');
    previewElement.style.backgroundImage = '';
    previewElement.classList.remove('custom');
    
    // For grape, ensure grape balls are visible in preview
    if (symbolType === 'grape') {
        const grapeBalls = previewElement.querySelectorAll('.grape-ball');
        grapeBalls.forEach(ball => {
            ball.style.display = '';
        });
    }
    
    // Delete from database if user is logged in - but don't wait for completion
    if (userAPI.userId) {
        userAPI.deleteCustomSymbol(symbolType)
            .then(success => {
                if (success) {
                    console.log(`Symbol ${symbolType} reset successfully in database`);
                }
            })
            .catch(error => {
                console.error(`Failed to reset symbol ${symbolType} in database:`, error);
            });
    }
    
    // Mark the symbol as reset, but don't apply the reset until save
    // This allows the user to change their mind before saving
    previewElement.dataset.reset = 'true';
}

function applySymbolReset(symbolType) {
    console.log(`Applying reset for symbol type: ${symbolType}`);
    
    // Process all reels to reset the specified symbol
    reels.forEach(reel => {
        // Process both main symbols and cloned symbols
        const allSymbols = [...reel.symbols, ...(reel.clonedSymbols || [])];
        
        allSymbols.forEach(symbolData => {
            if (symbolData && symbolData.type === symbolType) {
                const symbolElement = symbolData.element;
                const symbolContent = symbolElement.querySelector(`.symbol-content`);
                
                if (symbolContent) {
                    // Reset styling
                    symbolContent.style.backgroundImage = '';
                    symbolContent.classList.remove('custom');
                    
                    // For grape, need to ensure grape balls are visible again
                    if (symbolType === 'grape') {
                        const grapeBalls = symbolContent.querySelectorAll('.grape-ball');
                        if (grapeBalls.length === 0) {
                            // Need to recreate grape balls if they were removed
                            for (let k = 0; k < 6; k++) {
                                const grapeBall = document.createElement('div');
                                grapeBall.className = 'grape-ball';
                                symbolContent.appendChild(grapeBall);
                            }
                        } else {
                            // Make existing grape balls visible
                            grapeBalls.forEach(ball => {
                                ball.style.display = '';
                            });
                        }
                    }
                }
            }
        });
    });
}
// Save custom symbols and close the modal
function saveCustomSymbols() {
    console.log('Saving custom symbols');
    
    // Process any reset symbols that were marked for reset
    document.querySelectorAll('.symbol-content[data-reset="true"]').forEach(element => {
        const row = element.closest('.symbol-row');
        const symbolFile = row.querySelector('.symbol-file');
        const symbolType = symbolFile.dataset.symbol;
        
        console.log(`Applying reset for symbol: ${symbolType}`);
        
        // Apply reset to all instances of this symbol on the reels
        applySymbolReset(symbolType);
        
        // Remove the reset marker
        element.removeAttribute('data-reset');
    });
    
    // Save to localStorage as reliable storage
    try {
        // Save the entire customSymbols object
        localStorage.setItem('slotMachineCustomSymbols', JSON.stringify(customSymbols));
        
        // Also save individual symbols for easier access
        for (const symbolType in customSymbols) {
            localStorage.setItem(`symbol_${symbolType}`, customSymbols[symbolType]);
        }
        console.log('Saved all symbols to localStorage:', Object.keys(customSymbols));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
    
    // Apply custom symbols to the game immediately
    applyCustomSymbols();
    
    // Try to save to server if logged in (but don't wait for it)
    if (userAPI.userId) {
        // Don't use Promise.all as it will wait for everything
        // Instead, fire off independent save requests
        for (const symbolType in customSymbols) {
            userAPI.saveCustomSymbol(symbolType, customSymbols[symbolType])
                .catch(error => {
                    console.warn(`Server save failed for ${symbolType}, but localStorage backup exists`);
                });
        }
        console.log('Save requests sent to server (background)');
    }
    
    // Hide the modal immediately without waiting for server
    hideSymbolCustomizer();
}

// Load custom symbols from localStorage
function loadCustomSymbols() {
    // First, check localStorage
    let symbolsLoaded = false;
    
    try {
        // Try to load the full symbols object
        const savedSymbols = localStorage.getItem('slotMachineCustomSymbols');
        if (savedSymbols) {
            try {
                customSymbols = JSON.parse(savedSymbols);
                symbolsLoaded = true;
                console.log('Loaded custom symbols from localStorage');
            } catch (parseError) {
                console.error('Error parsing stored symbols:', parseError);
            }
        }
        
        // Also check for individual symbols (as a backup)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('symbol_')) {
                const symbolType = key.replace('symbol_', '');
                const data = localStorage.getItem(key);
                if (data && !customSymbols[symbolType]) {
                    customSymbols[symbolType] = data;
                    symbolsLoaded = true;
                }
            }
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
    
    // If we loaded from localStorage, apply symbols immediately
    if (symbolsLoaded) {
        updateSymbolPreviews();
        applyCustomSymbols();
        
        // Setup observer to keep symbols applied during animations
        if (!window.symbolObserver) {
            window.symbolObserver = setupCustomSymbolObserver();
        }
    }
    
    // Now try to load from server if logged in, but only add missing symbols
    // (localStorage takes precedence to avoid constant resets)
    if (userAPI.userId) {
        userAPI.loadCustomSymbols()
            .then(serverSymbols => {
                if (Object.keys(serverSymbols).length > 0) {
                    let hasNewSymbols = false;
                    
                    // Only add symbols that aren't already in localStorage
                    for (const symbolType in serverSymbols) {
                        if (!customSymbols[symbolType]) {
                            customSymbols[symbolType] = serverSymbols[symbolType];
                            hasNewSymbols = true;
                            
                            // Also save to localStorage for future sessions
                            try {
                                localStorage.setItem(`symbol_${symbolType}`, serverSymbols[symbolType]);
                            } catch (e) {
                                console.warn('Failed to save symbol to localStorage:', e);
                            }
                        }
                    }
                    
                    if (hasNewSymbols) {
                        // Save the full collection to localStorage
                        try {
                            localStorage.setItem('slotMachineCustomSymbols', JSON.stringify(customSymbols));
                        } catch (e) {
                            console.warn('Failed to save symbols collection to localStorage:', e);
                        }
                        
                        updateSymbolPreviews();
                        applyCustomSymbols();
                        console.log('Added missing symbols from server');
                    }
                }
            })
            .catch(error => {
                console.warn('Server load failed, using localStorage symbols only');
            });
    }
}
// Apply custom symbols to the game
function applyCustomSymbols() {
    // Only proceed if we have custom symbols defined
    if (Object.keys(customSymbols).length === 0) return;
    
    console.log("Applying custom symbols to all reels");
    
    // For each reel
    reels.forEach(reel => {
        // Process both main symbols and cloned symbols
        const allSymbols = [...reel.symbols, ...(reel.clonedSymbols || [])];
        
        allSymbols.forEach(symbolData => {
            if (!symbolData || !symbolData.element) return;
            
            const symbolType = symbolData.type;
            const symbolElement = symbolData.element;
            const symbolContent = symbolElement.querySelector(`.symbol-content`);
            
            if (!symbolContent) return;
            
            // Add a data attribute to track the symbol type - makes it easier to re-apply symbols
            symbolElement.setAttribute('data-symbol-type', symbolType);
            
            // If this symbol has a custom image, apply it
            if (customSymbols[symbolType]) {
                // Apply custom image
                symbolContent.style.backgroundImage = `url('${customSymbols[symbolType]}')`;
                symbolContent.classList.add('custom');
                
                // Hide grape balls if this is a grape symbol
                if (symbolType === 'grape') {
                    const grapeBalls = symbolContent.querySelectorAll('.grape-ball');
                    grapeBalls.forEach(ball => {
                        ball.style.display = 'none';
                    });
                }
            } else {
                // Reset to default if no custom image
                symbolContent.style.backgroundImage = '';
                symbolContent.classList.remove('custom');
                
                // Show grape balls if this is a grape symbol
                if (symbolType === 'grape') {
                    const grapeBalls = symbolContent.querySelectorAll('.grape-ball');
                    if (grapeBalls.length === 0) {
                        // Need to recreate grape balls if they were removed
                        for (let k = 0; k < 6; k++) {
                            const grapeBall = document.createElement('div');
                            grapeBall.className = 'grape-ball';
                            symbolContent.appendChild(grapeBall);
                        }
                    } else {
                        grapeBalls.forEach(ball => {
                            ball.style.display = '';
                        });
                    }
                }
            }
        });
    });
}

// Update the createSymbolElement function to handle custom symbols
function createSymbolElement(symbol) {
    // Create symbol element
    const symbolElement = document.createElement('div');
    symbolElement.className = 'symbol';
    
    const symbolContent = document.createElement('div');
    symbolContent.className = `symbol-content ${symbol.cssClass}`;
    
    // Check if this symbol type has a custom image
    if (customSymbols[symbol.name]) {
        symbolContent.style.backgroundImage = `url('${customSymbols[symbol.name]}')`;
        symbolContent.classList.add('custom');
    } 
    
    // For grape, add inner elements (will be hidden by CSS if custom image is used)
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


// Initialize game on load
window.addEventListener('load', initGame);