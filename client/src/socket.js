import { io } from 'socket.io-client';
import { API_URL } from './config';

export function createSocket() {
    return io(API_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 5
    });
}
