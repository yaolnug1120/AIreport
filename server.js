const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store connected players: { socketId: { id, name, score } }
let players = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initialize player
    players[socket.id] = {
        id: socket.id,
        name: `Player ${socket.id.substr(0, 4)}`, // Default name
        score: 0
    };

    // Send current leaderboard to the new player
    socket.emit('updateLeaderboard', Object.values(players).sort((a, b) => b.score - a.score));

    // Broadcast new player to everyone
    io.emit('updateLeaderboard', Object.values(players).sort((a, b) => b.score - a.score));

    // Handle name change
    socket.on('setName', (name) => {
        if (players[socket.id]) {
            players[socket.id].name = name || `Player ${socket.id.substr(0, 4)}`;
            io.emit('updateLeaderboard', Object.values(players).sort((a, b) => b.score - a.score));
        }
    });

    // Handle score update
    socket.on('updateScore', (score) => {
        if (players[socket.id] && typeof score === 'number' && !isNaN(score)) {
            players[socket.id].score = score;
            // Broadcast updated leaderboard
            io.emit('updateLeaderboard', Object.values(players).sort((a, b) => b.score - a.score));
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('updateLeaderboard', Object.values(players).sort((a, b) => b.score - a.score));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
