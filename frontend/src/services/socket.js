import { io } from 'socket.io-client';

let currentUser = null;

const getTokenForUser = (user) => {
  if (typeof window === 'undefined') return null;

  let effectiveUser = user;
  if (!effectiveUser) {
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('customer_user');
      if (stored) effectiveUser = JSON.parse(stored);
    } catch {}
  }

  if (effectiveUser?.isGuest) return null;

  const role = effectiveUser?.role?.toUpperCase();
  const prefix = role === 'ADMIN' ? 'admin' : role === 'VENDOR' ? 'vendor' : role === 'KITCHEN' ? 'kitchen' : 'customer';
  return sessionStorage.getItem(`${prefix}_token`) ||
    localStorage.getItem(`${prefix}_token`) ||
    sessionStorage.getItem('customer_token') ||
    localStorage.getItem('customer_token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('token');
};

const sanitizeUrl = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  // Extract pure http(s) URL in case accidental UI labels (e.g. "Copy URL \n") were pasted
  const match = raw.match(/https?:\/\/[^\s"'`]+/i);
  return match ? match[0] : raw.trim();
};

const getSocketUrl = () => {
  const socketEnv = sanitizeUrl(typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SOCKET_URL : null);
  if (socketEnv) {
    return socketEnv.replace(/\/$/, '');
  }
  const apiEnv = sanitizeUrl(typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : null);
  if (apiEnv) {
    return apiEnv.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host.includes('zovikpos.store') || host.includes('vercel.app')) {
      return 'https://zovikpos-production-92cf.up.railway.app';
    }
    return `http://${window.location.hostname}:5001`;
  }
  return 'http://localhost:5001';
};

// Create a single persistent socket instance so event listeners are preserved
export const socket = io(getSocketUrl(), {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  auth: (cb) => {
    const token = getTokenForUser(currentUser);
    cb(token ? { token } : {});
  },
});

socket.on('connect', () => {
  console.log('Connected to socket server with ID:', socket.id);
  if (typeof window !== 'undefined') {
    const sessionId = localStorage.getItem('customer_sessionId');
    if (sessionId) {
      socket.emit('join:session', sessionId);
    }
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from socket server:', reason);
});

export const connectSocket = (user) => {
  const nextUser = user || null;
  const token = getTokenForUser(nextUser);
  const currentIdentity = currentUser ? `${currentUser.role}:${currentUser.id}` : 'guest';
  const nextIdentity = nextUser ? `${nextUser.role}:${nextUser.id}` : 'guest';
  const previousToken = socket.auth?.token || null;

  socket.auth = token ? { token } : {};
  currentUser = user;

  if (socket.connected && (currentIdentity !== nextIdentity || previousToken !== token)) {
    socket.disconnect();
    socket.connect();
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  // Keep socket instance intact for persistent event subscriptions
};
