# 2048 Online Multiplayer

This is a multiplayer version of the 2048 game with a live leaderboard.

## Requirements

- Node.js (v14 or higher)
- npm

## How to Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start the Server**
    ```bash
    npm start
    ```

3.  **Play the Game**
    Open your browser and navigate to `http://localhost:3000`.

## Troubleshooting

-   **Game cannot run / GitHub 404**: This application requires a Node.js server to run. It **cannot** be hosted on static hosting services like GitHub Pages because it relies on the backend for multiplayer features (Socket.io). You must run the server code (`node server.js`).
