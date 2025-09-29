const API_BASE = 'https://backand-chat.onrender.com';

let socket;
let currentChatFriend = null;

// Check if user is logged in
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
let userId = localStorage.getItem('userId');

// If userId is null, try to decode from token
if (!userId && token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        userId = payload.id;
        localStorage.setItem('userId', userId);
        console.log('Decoded userId:', userId);
    } catch (e) {
        console.error('Failed to decode token', e);
        userId = 'N/A';
    }
} else if (!userId) {
    userId = 'N/A';
}

if (window.location.pathname.endsWith('chat.html')) {
    console.log('On chat page, token:', !!token, 'username:', username);
    if (!token) {
        window.location.href = 'index.html';
    } else {
        document.getElementById('username').textContent = `${username} (ID: ${userId})`;
        console.log('Creating socket with token');
        socket = io(API_BASE, { auth: { token } });

        socket.on('connect', () => {
            console.log('Connected to server');
            loadFriends();
            loadFriendRequests();
            loadAllUsers();
        });

        socket.on('newMessage', (message) => {
            if (currentChatFriend && (message.sender_id == currentChatFriend.id || message.recipient_id == currentChatFriend.id)) {
                displayMessage(message);
                scrollToBottom();
            }
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            alert('Connection failed. Please refresh the page.');
        });
    }
}

// Login form
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('userId', data.id);
                window.location.href = 'chat.html';
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Login failed');
        }
    });
}

// Register form
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Registration successful! Please login.');
                window.location.href = 'index.html';
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Registration failed');
        }
    });
}

// Chat functionality
if (window.location.pathname.endsWith('chat.html')) {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesDiv = document.getElementById('messages');
    const friendsList = document.getElementById('friendsList');
    const friendRequests = document.getElementById('friendRequests');
    const addFriendBtn = document.getElementById('addFriendBtn');
    const chatTitle = document.getElementById('chatTitle');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const allUsers = document.getElementById('allUsers');

    function loadMessages(recipientId) {
        fetch(`${API_BASE}/messages?recipient_id=${recipientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(messages => {
            messagesDiv.innerHTML = '';
            messages.forEach(displayMessage);
            scrollToBottom();
        })
        .catch(error => console.error('Error loading messages:', error));
    }

    function displayMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender_username === username ? 'sent' : 'received'}`;

        const usernameSpan = document.createElement('div');
        usernameSpan.className = 'username';
        usernameSpan.textContent = message.sender_username;

        const contentDiv = document.createElement('div');
        contentDiv.textContent = message.content;

        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp';
        timestampDiv.textContent = new Date(message.timestamp).toLocaleString();

        messageDiv.appendChild(usernameSpan);
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timestampDiv);

        messagesDiv.appendChild(messageDiv);
    }

    function scrollToBottom() {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function sendMessage() {
        const content = messageInput.value.trim();
        if (content && currentChatFriend) {
            if (!socket || !socket.connected) {
                alert('Not connected to server. Please refresh the page.');
                return;
            }
            socket.emit('sendMessage', { content, recipientId: currentChatFriend.id });
            messageInput.value = '';
        }
    }

    function loadFriends() {
        fetch(`${API_BASE}/friends`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(friends => {
            friendsList.innerHTML = '';
            friends.forEach(friend => {
                const friendDiv = document.createElement('div');
                friendDiv.className = 'friend-item';
                friendDiv.textContent = friend.username;
                friendDiv.addEventListener('click', () => selectFriend(friend));
                friendsList.appendChild(friendDiv);
            });
        })
        .catch(error => console.error('Error loading friends:', error));
    }

    function selectFriend(friend) {
        currentChatFriend = friend;
        chatTitle.textContent = `Chat with ${friend.username}`;
        messageInputContainer.style.display = 'flex';
        document.querySelectorAll('.friend-item').forEach(item => item.classList.remove('selected'));
        event.target.classList.add('selected');
        socket.emit('joinChat', { friendId: friend.id });
        loadMessages(friend.id);
    }

    function loadFriendRequests() {
        fetch(`${API_BASE}/friends/requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(requests => {
            friendRequests.innerHTML = '';
            requests.forEach(request => {
                const requestDiv = document.createElement('div');
                requestDiv.className = 'friend-request';
                requestDiv.innerHTML = `
                    <span>Friend request from ${request.username}</span>
                    <button onclick="acceptFriend(${request.sender_id})">Accept</button>
                `;
                friendRequests.appendChild(requestDiv);
            });
        })
        .catch(error => console.error('Error loading friend requests:', error));
    }

    function loadAllUsers() {
        fetch(`${API_BASE}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(users => {
            allUsers.innerHTML = '';
            users.forEach(user => {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item';
                userDiv.innerHTML = `
                    <span>${user.username} (ID: ${user.id})</span>
                    <button onclick="sendFriendRequest(${user.id})">Invite</button>
                `;
                allUsers.appendChild(userDiv);
            });
        })
        .catch(error => console.error('Error loading users:', error));
    }

    function sendFriendRequest(friendId) {
        fetch(`${API_BASE}/friends/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ friend_id: friendId })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message || data.error);
        })
        .catch(error => console.error('Error sending friend request:', error));
    }

    window.sendFriendRequest = sendFriendRequest;

    function acceptFriend(requestId) {
        fetch(`${API_BASE}/friends/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ friend_id: requestId })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            loadFriends();
            loadFriendRequests();
        })
        .catch(error => console.error('Error accepting friend:', error));
    }

    window.acceptFriend = acceptFriend;

    addFriendBtn.addEventListener('click', () => {
        const friendId = prompt('Enter friend user ID:');
        if (friendId) {
            fetch(`${API_BASE}/friends/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ friend_id: parseInt(friendId) })
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message || data.error);
            })
            .catch(error => console.error('Error sending friend request:', error));
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = 'index.html';
    });

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}