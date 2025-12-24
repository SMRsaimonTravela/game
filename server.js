const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const gameManager = new GameManager(io);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.render('game');
});

app.get('/game', (req, res) => {
    res.render('game');
});

app.get('/admin', (req, res) => {
    res.render('admin');
});

// Socket.io
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    gameManager.handleConnection(socket);

    socket.on('joinGame', (name) => {
        gameManager.joinGame(socket, name);
    });

    socket.on('startGame', () => {
        gameManager.startGame();
    });

    socket.on('stopGame', () => {
        gameManager.stopGame();
    });

    socket.on('pickName', (pickedName) => {
        gameManager.pickName(socket, pickedName);
    });

    socket.on('calculateResults', () => {
        gameManager.calculateResults();
    });

    socket.on('resetGame', () => {
        gameManager.resetGame();
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        gameManager.handleDisconnect(socket);
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
