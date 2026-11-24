// ========================
// EL-KHETM — Socket.io Event Handler
// ========================

import type { Server as SocketServer, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, DocumentCardType } from '@el-khetm/shared';
import { GAME_CONSTANTS, MEME_STICKERS } from '@el-khetm/shared';
import { RoomManager } from './RoomManager';
import { v4 as uuidv4 } from 'uuid';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandler(io: SocketServer, roomManager: RoomManager): void {
  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as TypedSocket;

    // --- Room Creation ---
    socket.on('room:create', (data: { playerName: string; avatarId: string; sessionId: string }) => {
      const { playerName, avatarId, sessionId } = data;
      if (!playerName?.trim()) {
        socket.emit('room:error', { message: 'لازم تكتب اسمك الأول' });
        return;
      }

      const playerId = uuidv4().slice(0, 12);
      const room = roomManager.createRoom(playerId);
      room.addPlayer(playerId, playerName.trim(), avatarId || 'student', sessionId, socket.id);

      socket.join(room.roomCode);
      socket.data = { roomCode: room.roomCode, playerId, sessionId };
      socket.emit('room:created', { roomCode: room.roomCode, playerId });
      room.broadcastLobbyState();
    });

    // --- Room Joining ---
    socket.on('room:join', (data: { roomCode: string; playerName: string; avatarId: string; sessionId: string }) => {
      const { roomCode, playerName, avatarId, sessionId } = data;
      if (!playerName?.trim()) {
        socket.emit('room:error', { message: 'لازم تكتب اسمك الأول' });
        return;
      }

      const room = roomManager.getRoom(roomCode);
      if (!room) {
        socket.emit('room:error', { message: 'الغرفة مش موجودة' });
        return;
      }

      if (room.phase !== 'LOBBY') {
        const existing = room.findPlayerBySession(sessionId);
        if (existing) {
          existing.socketId = socket.id;
          existing.isDisconnected = false;
          socket.join(room.roomCode);
          socket.data = { roomCode: room.roomCode, playerId: existing.id, sessionId };
          socket.emit('room:joined', { roomCode: room.roomCode, playerId: existing.id });
          room.broadcastState();
          return;
        }
        socket.emit('room:error', { message: 'الجيم بدأ بالفعل' });
        return;
      }

      if (room.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
        socket.emit('room:error', { message: 'الغرفة مليانة' });
        return;
      }

      const playerId = uuidv4().slice(0, 12);
      room.addPlayer(playerId, playerName.trim(), avatarId || 'student', sessionId, socket.id);

      socket.join(room.roomCode);
      socket.data = { roomCode: room.roomCode, playerId, sessionId };
      socket.emit('room:joined', { roomCode: room.roomCode, playerId });
      room.broadcastLobbyState();
    });

    // --- Quick Play ---
    socket.on('room:quick_play', (data: { playerName: string; avatarId: string; sessionId: string; botCount: number }) => {
      const { playerName, avatarId, sessionId, botCount } = data;
      if (!playerName?.trim()) {
        socket.emit('room:error', { message: 'لازم تكتب اسمك الأول' });
        return;
      }

      const playerId = uuidv4().slice(0, 12);
      const room = roomManager.createRoom(playerId);
      room.addPlayer(playerId, playerName.trim(), avatarId || 'student', sessionId, socket.id);

      const bots = Math.max(1, Math.min(5, botCount || 3));
      for (let i = 0; i < bots; i++) {
        room.addBot();
      }

      socket.join(room.roomCode);
      socket.data = { roomCode: room.roomCode, playerId, sessionId };
      socket.emit('room:created', { roomCode: room.roomCode, playerId });
      room.broadcastLobbyState();

      setTimeout(() => room.startGame(), 500);
    });

    // --- Reconnect ---
    socket.on('room:reconnect', (data: { roomCode: string; sessionId: string }) => {
      const { roomCode, sessionId } = data;
      const room = roomManager.getRoom(roomCode);
      if (!room) {
        socket.emit('room:error', { message: 'الغرفة مش موجودة' });
        return;
      }

      const player = room.handleReconnect(sessionId, socket.id);
      if (!player) {
        socket.emit('room:error', { message: 'مش لاقي حسابك في الغرفة دي' });
        return;
      }

      socket.join(room.roomCode);
      socket.data = { roomCode: room.roomCode, playerId: player.id, sessionId };
      socket.emit('room:joined', { roomCode: room.roomCode, playerId: player.id });
    });

    // --- Add Bot ---
    socket.on('room:add_bot', () => {
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      if (room.hostId !== playerId) return;

      const bot = room.addBot();
      if (!bot) {
        socket.emit('room:error', { message: 'الغرفة مليانة' });
        return;
      }
      room.broadcastLobbyState();
    });

    // --- Remove Bot ---
    socket.on('room:remove_bot', (data: { botId: string }) => {
      const { botId } = data;
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      if (room.hostId !== playerId) return;

      room.removeBot(botId);
      room.broadcastLobbyState();
    });

    // --- Start Game ---
    socket.on('room:start_game', () => {
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      if (room.hostId !== playerId) return;

      if (room.players.length < GAME_CONSTANTS.MIN_PLAYERS) {
        socket.emit('room:error', { message: 'لازم لاعبين على الأقل' });
        return;
      }

      room.startGame();
    });

    // --- Leave Room ---
    socket.on('room:leave', () => {
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode) return;

      // Always leave the socket room and clear socket metadata first so the leaving
      // player never receives stale broadcasts from the old room
      socket.leave(roomCode);
      socket.data = {};

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      if (room.phase === 'LOBBY') {
        room.removePlayer(playerId);
        if (room.isEmpty) {
          roomManager.deleteRoom(roomCode);
        } else {
          room.broadcastLobbyState();
        }
      } else {
        room.handleDisconnect(socket.id);
        if (room.phase === 'GAME_OVER' && room.connectedHumanCount === 0) {
          roomManager.deleteRoom(roomCode);
        }
      }
    });

    // --- Play Card ---
    socket.on('action:play_card', (data: { cardInstanceId: string; targetPlayerId?: string; targetDocument?: DocumentCardType }) => {
      const { cardInstanceId, targetPlayerId, targetDocument } = data;
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      room.handlePlayCard(playerId, cardInstanceId, targetPlayerId, targetDocument);
    });

    // --- End Turn ---
    socket.on('action:end_turn', () => {
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      room.handleEndTurn(playerId);
    });

    // --- React ---
    socket.on('action:react', (data: { block: boolean }) => {
      const { block } = data;
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      room.handleReaction(playerId, block);
    });

    // --- Pick Archive ---
    socket.on('action:pick_archive', (data: { cardInstanceId: string }) => {
      const { cardInstanceId } = data;
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      room.handlePickArchive(playerId, cardInstanceId);
    });

    // --- Discard Cards ---
    socket.on('action:discard_cards', (data: { cardInstanceIds: string[] }) => {
      const { cardInstanceIds } = data;
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      room.handleDiscardCards(playerId, cardInstanceIds);
    });

    // --- Send Meme Sticker ---
    socket.on('action:send_sticker', (data: { stickerId: string }) => {
      const { stickerId } = data;
      const { roomCode, playerId } = socket.data || {} as Record<string, string>;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;
      if (!MEME_STICKERS.some(s => s.id === stickerId)) return;

      room.handleSendSticker(playerId, stickerId);
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      const { roomCode } = socket.data || {} as Record<string, string>;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      if (room.phase === 'LOBBY') {
        const player = room.findPlayerBySocket(socket.id);
        if (player) {
          room.removePlayer(player.id);
          if (room.isEmpty) {
            roomManager.deleteRoom(roomCode);
          } else {
            room.broadcastLobbyState();
          }
        }
      } else {
        room.handleDisconnect(socket.id);
      }
    });
  });
}
