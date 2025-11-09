const { error } = require('node:console');
const net = require('node:net');

const PORT = 4000;

const server = net.createServer();

const clients = new Map();

const usernames = new Set();


function broadcast(message, senderSocket = null) {   
    for (const clientSocket of clients.keys()) {        
        if (clientSocket !== senderSocket) {     
            clientSocket.write(message);
        }
    }
}


server.on('connection', (socket) => {
    console.log('[SERVER] A new user has connected.');

    let buffer = '';
    socket.on('data', (chunk) => {
        try {
            buffer += chunk.toString('utf-8');
            let lines = buffer.split('\n');
            
            // Keep the last, possibly incomplete line in the buffer
            buffer = lines.pop() || ''; 

            lines.forEach((line) => {
                const data = line.trim();
                
                // Skip empty lines
                if (!data) {
                    return;
                }

                // Check if this socket is already logged in
                const isLoggedIn = clients.has(socket);
                
                if (!isLoggedIn) {
                    // --- HANDLE LOGIN ---
                    const parts = data.split(' ');
                    const command = parts[0];
                    const username = parts[1];

                    if (command === 'LOGIN') {
                        // Check for errors: no username, or username already in use
                        if (!username) {
                            socket.write('ERR Invalid LOGIN format. Use: LOGIN <username>\n');
                        } else if (usernames.has(username)) {
                            socket.write('ERR username-taken\n');
                        } else {
                            // --- Success! Log them in ---
                            console.log(`[SERVER] User ${username} has logged in.`);
                            
                            // 1. Add username to the set
                            usernames.add(username);
                            
                            // 2. Add socket to the map with its username
                            clients.set(socket, { username: username });
                            
                            // 3. Send OK
                            socket.write('OK\n');
                        }
                    } else {
                        console.log('[SERVER] User sent command before login. Ignoring.');
                    }
                } else {
                    const parts = data.split(' ');
                    const command = parts[0];
                    const user = clients.get(socket); // Get user data

                    if (command === 'MSG') {
                        // Get the text (everything after "MSG ")
                        const text_string = data.substring(4); // "MSG " is 4 chars

                        if (text_string) {
                            const message = `MSG ${user.username} ${text_string}\n`;
                            broadcast(message, socket);
                        }
                    } else {
                         console.log(`[SERVER] Unknown command from ${user.username}: ${command}`);
                    }
                }
            });
        } catch (e) {
            console.error('[SERVER] Following error', e);
        }
    });


    const handleDisconnect = () => {
        if (clients.has(socket)) {
            // Get the username before deleting
            const user = clients.get(socket);
            const username = user.username;

            // 1. Remove from usernames set
            usernames.delete(username);
            
            // 2. Remove from clients map
            clients.delete(socket);
            
            console.log(`[SERVER] User ${username} has disconnected.`);
            
            // Broadcast the disconnect message to all remaining users
            broadcast(`INFO ${username} disconnected\n`, socket);
        }
    };

    socket.on('end', () => {
        console.log('[SERVER] User connection ended.');
        handleDisconnect();
    });
    
    socket.on('error', (err) => {
        // Handle abrupt disconnects
        if (err.code === 'ECONNRESET') {
            console.log('[SERVER] User disconnected abruptly.');
        } else {
            console.log(`[SERVER] Socket Error: ${err.message}`);
        }
        handleDisconnect(); 
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] TCP chat server is running on port ${PORT}.`);
});