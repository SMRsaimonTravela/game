document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // DOM Elements
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    const usernameInput = document.getElementById('username');
    const joinBtn = document.getElementById('join-btn');
    const userNameDisplay = document.getElementById('user-name-display');
    const waitingText = document.getElementById('waiting-text');
    const greetingArea = document.getElementById('greeting-area');
    const pickingArea = document.getElementById('picking-area');
    const pickBtn = document.getElementById('pick-btn');
    const myPicksList = document.getElementById('my-picks');
    const availableNamesList = document.getElementById('available-names-list');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const resultsArea = document.getElementById('results-area');
    const resultsList = document.getElementById('results-list');
    const debugConsole = document.getElementById('debug-console');
    const namesCount = document.getElementById('names-count');
    const picksCount = document.getElementById('picks-count');

    // Admin Elements
    const startGameBtn = document.getElementById('start-game-btn');
    const calcResultsBtn = document.getElementById('calc-results-btn');
    const resetGameBtn = document.getElementById('reset-game-btn');
    const gameStatusSpan = document.getElementById('game-status');
    const userCountSpan = document.getElementById('user-count');
    const userListUl = document.getElementById('user-list');
    const adminResultsArea = document.getElementById('admin-results');
    const adminResultsList = document.getElementById('admin-results-list');

    let myName = '';
    let allUsers = [];

    const isAdminPage = window.isAdmin === true;

    function log(msg) {
        console.log(msg);
        if (debugConsole) {
            const logContent = debugConsole.querySelector('.log-content');
            if (logContent) {
                const p = document.createElement('div');
                p.textContent = msg;
                logContent.prepend(p);
            }
        }
    }

    function shuffleNamesList() {
        if (!availableNamesList) return;
        const tags = Array.from(availableNamesList.children);
        for (let i = tags.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            availableNamesList.appendChild(tags[j]);
        }
    }

    function renderTags(container, items) {
        if (!container) return;
        container.innerHTML = items.map(item => `<span class="tag">${item}</span>`).join('');
    }

    function renderResults(container, results) {
        if (!container) return;
        const rankLabels = ['1st', '2nd', '3rd'];
        const rankClasses = ['gold', 'silver', 'bronze'];

        container.innerHTML = results.map((r, index) => {
            const rankClass = index < 3 ? rankClasses[index] : '';
            const rankLabel = index < 3 ? rankLabels[index] : `${index + 1}th`;
            return `
                <div class="result-item ${rankClass}">
                    <span class="result-rank">${rankLabel}</span>
                    <span class="result-name">${r.name}</span>
                    <span class="result-arrow">→</span>
                    <span class="result-count">${r.count} picks</span>
                </div>
            `;
        }).join('');
    }

    // Auto-join
    const storedName = localStorage.getItem('userName');
    if (storedName && !isAdminPage) {
        socket.emit('joinGame', storedName);
    }

    // Event Listeners
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            const name = usernameInput.value.trim();
            if (name) {
                localStorage.setItem('userName', name);
                socket.emit('joinGame', name);
            } else {
                alert('Please enter a name');
            }
        });
    }

    if (pickBtn) {
        pickBtn.addEventListener('click', () => {
            if (allUsers.length === 0) {
                alert('No users to pick from!');
                return;
            }
            const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];
            socket.emit('pickName', randomUser);
            setTimeout(() => shuffleNamesList(), 300);
        });
    }

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => shuffleNamesList());
    }

    // Admin Controls
    if (isAdminPage) {
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => {
                const isStarted = startGameBtn.textContent === 'Stop';
                socket.emit(isStarted ? 'stopGame' : 'startGame');
            });
        }
        if (calcResultsBtn) calcResultsBtn.addEventListener('click', () => socket.emit('calculateResults'));
        if (resetGameBtn) resetGameBtn.addEventListener('click', () => socket.emit('resetGame'));
    }

    // Socket Events
    socket.on('connect', () => log('Connected to server'));

    socket.on('joined', (data) => {
        myName = data.name;
        if (loginScreen) loginScreen.style.display = 'none';
        if (gameScreen) {
            gameScreen.style.display = 'block';
            if (userNameDisplay) userNameDisplay.textContent = myName;
        }
    });

    socket.on('error', (msg) => {
        log(`Error: ${msg}`);
        alert(msg);
    });

    socket.on('resultError', (msg) => {
        log(msg);
        alert(msg);
    });

    socket.on('globalLog', (data) => log(data.message));

    socket.on('gameState', (state) => {
        if (gameStatusSpan) gameStatusSpan.textContent = state;

        if (state === 'STARTED') {
            if (waitingText) waitingText.style.display = 'none';
            if (greetingArea) greetingArea.querySelector('h2').textContent = `Let's go, ${myName}! 🎲`;
            if (pickingArea) pickingArea.style.display = 'block';
            if (resultsArea) resultsArea.style.display = 'none';
            if (adminResultsArea) adminResultsArea.style.display = 'none';
            if (startGameBtn) startGameBtn.textContent = 'Stop';
            setTimeout(() => shuffleNamesList(), 500);
        } else if (state === 'FINISHED') {
            if (waitingText) waitingText.style.display = 'none';
            if (greetingArea) greetingArea.style.display = 'none';
            if (pickingArea) pickingArea.style.display = 'none';
            if (resultsArea) resultsArea.style.display = 'block';
            if (adminResultsArea) adminResultsArea.style.display = 'block';
            if (startGameBtn) startGameBtn.textContent = 'Start';
        } else if (state === 'WAITING') {
            if (waitingText) {
                waitingText.style.display = 'block';
                waitingText.textContent = 'Please wait for the admin to start the game...';
            }
            if (greetingArea) {
                greetingArea.style.display = 'block';
                if (myName && greetingArea.querySelector('h2')) {
                    greetingArea.querySelector('h2').textContent = `Welcome, ${myName}! 🎉`;
                }
            }
            if (pickingArea) pickingArea.style.display = 'none';
            if (resultsArea) resultsArea.style.display = 'none';
            if (adminResultsArea) adminResultsArea.style.display = 'none';
            if (myPicksList) myPicksList.innerHTML = '';
            if (resultsList) resultsList.innerHTML = '';
            if (adminResultsList) adminResultsList.innerHTML = '';
            if (startGameBtn) startGameBtn.textContent = 'Start';
            if (picksCount) picksCount.textContent = '0';
        }
    });

    socket.on('userList', (users) => {
        allUsers = users;
        if (userCountSpan) userCountSpan.textContent = users.length;
        if (namesCount) namesCount.textContent = users.length;

        renderTags(userListUl, users);
        renderTags(availableNamesList, users);
        shuffleNamesList();
    });

    socket.on('updatePicks', (picks) => {
        if (picksCount) picksCount.textContent = picks.length;
        renderTags(myPicksList, picks);
    });

    socket.on('gameFinished', (results) => {
        log('🏆 Results are ready!');
        renderResults(resultsList, results);
        renderResults(adminResultsList, results);
    });

    socket.on('gameReset', () => {
        log('Game has been reset');
        alert('Game has been reset by admin.');
        localStorage.removeItem('userName');
        location.reload();
    });
});
