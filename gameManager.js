const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

class GameManager {
    constructor(io) {
        this.io = io;
        this.users = new Map(); // socketId -> { name, picks: [] }
        this.gameState = 'WAITING'; // WAITING, STARTED, FINISHED
        this.picks = []; // Array of { picker: name, picked: name }
        this.maxPicks = 3;
        this.storedUsers = this.loadStoredUsers();
    }

    // Helper methods for user persistence
    loadStoredUsers() {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    }

    saveUsers() {
        fs.writeFileSync(USERS_FILE, JSON.stringify(this.storedUsers, null, 2), 'utf8');
    }

    clearStoredUsers() {
        this.storedUsers = [];
        fs.writeFileSync(USERS_FILE, '[]', 'utf8');
    }

    saveUser(name) {
        let user = this.storedUsers.find(u => u.name === name);
        if (!user) {
            user = { name, picks: [] };
            this.storedUsers.push(user);
            this.saveUsers();
        }
        return user;
    }

    updateUserPicks(name, picks) {
        const user = this.storedUsers.find(u => u.name === name);
        if (user) {
            user.picks = picks;
            this.saveUsers();
        }
    }

    // Connection and Disconnection handlers
    handleConnection(socket) {
        // Send current state to new user
        socket.emit('gameState', this.gameState);
        // Send current user list (for admin reload)
        this.broadcastUserList();
    }

    handleDisconnect(socket) {
        if (this.users.has(socket.id)) {
            const user = this.users.get(socket.id);
            console.log(`User ${user.name} disconnected`);
            this.users.delete(socket.id);
            this.broadcastUserList();
        }
    }

    // Broadcast log message to all users
    broadcastLog(message) {
        this.io.emit('globalLog', {
            time: new Date().toLocaleTimeString(),
            message: message
        });
    }

    // Game logic methods
    joinGame(socket, name) {
        // Load existing picks if any
        const storedUser = this.saveUser(name);

        this.users.set(socket.id, { name, picks: storedUser.picks || [] });

        socket.emit('joined', { name });
        socket.emit('gameState', this.gameState);

        // Send existing picks to the user
        if (storedUser.picks && storedUser.picks.length > 0) {
            socket.emit('updatePicks', storedUser.picks);
        }

        // Broadcast to everyone that user joined
        this.broadcastLog(`${name} has joined the game`);

        this.broadcastUserList();
    }

    startGame() {
        this.gameState = 'STARTED';
        this.broadcastLog(`🎮 Game has started! Pick your names now`);
        this.io.emit('gameStarted');
        this.io.emit('gameState', this.gameState);
    }

    stopGame() {
        this.gameState = 'WAITING';
        this.broadcastLog(`⏸️ Game has been paused`);
        this.io.emit('gameState', this.gameState);
    }

    pickName(socket, pickedName) {
        if (this.gameState !== 'STARTED') return;

        const user = this.users.get(socket.id);
        if (!user) return;

        if (user.picks.length >= this.maxPicks) {
            socket.emit('error', 'Max picks reached');
            return;
        }

        user.picks.push(pickedName);
        this.picks.push({ picker: user.name, picked: pickedName });

        // Persist picks
        this.updateUserPicks(user.name, user.picks);

        socket.emit('updatePicks', user.picks);

        // Broadcast to everyone who picked whom
        this.broadcastLog(`${user.name} picked ${pickedName}`);

        // Notify admin of progress
        this.io.emit('adminUpdate', {
            totalPicks: this.picks.length,
            usersDone: Array.from(this.users.values()).filter(u => u.picks.length === this.maxPicks).length
        });
    }

    calculateResults() {
        // Check if all users have picked 3 names
        const allUsersPicked = Array.from(this.users.values()).every(u => u.picks.length >= this.maxPicks);

        if (!allUsersPicked) {
            // Notify admin that not all users have finished picking
            const pendingUsers = Array.from(this.users.values())
                .filter(u => u.picks.length < this.maxPicks)
                .map(u => `${u.name} (${u.picks.length}/3)`);

            this.io.emit('resultError', `Not all users have picked 3 names. Pending: ${pendingUsers.join(', ')}`);
            return;
        }

        const counts = {};
        this.picks.forEach(p => {
            counts[p.picked] = (counts[p.picked] || 0) + 1;
        });

        const sortedResults = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));

        this.gameState = 'FINISHED';
        this.broadcastLog(`🏆 Results are ready!`);
        this.io.emit('gameFinished', sortedResults);
        this.io.emit('gameState', this.gameState);
    }

    resetGame() {
        this.users.clear();
        this.picks = [];
        this.storedUsers = [];
        this.clearStoredUsers(); // Clear users.json file
        this.gameState = 'WAITING';
        this.io.emit('gameReset');
        this.io.emit('gameState', this.gameState);
    }

    broadcastUserList() {
        const userList = Array.from(this.users.values()).map(u => u.name);
        this.io.emit('userList', userList);
    }
}

module.exports = GameManager;
