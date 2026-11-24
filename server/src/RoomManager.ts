// ========================
// EL-KHETM — Room Manager
// ========================

import type { Server as SocketServer } from 'socket.io';
import { GameRoom } from './engine/GameRoom';
import { GAME_CONSTANTS } from '@el-khetm/shared';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < GAME_CONSTANTS.ROOM_CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private io: SocketServer;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(io: SocketServer) {
    this.io = io;
    // Periodic cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  public createRoom(hostId: string): GameRoom {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }
    const room = new GameRoom(code, hostId, this.io);
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public deleteRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.destroy();
      this.rooms.delete(roomCode);
    }
  }

  public findRoomBySocket(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.findPlayerBySocket(socketId)) return room;
    }
    return undefined;
  }

  public findRoomBySession(sessionId: string): { room: GameRoom; playerId: string } | undefined {
    for (const room of this.rooms.values()) {
      const player = room.findPlayerBySession(sessionId);
      if (player) return { room, playerId: player.id };
    }
    return undefined;
  }

  private cleanup(): void {
    for (const [code, room] of this.rooms.entries()) {
      if (room.shouldCleanup) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    for (const room of this.rooms.values()) {
      room.destroy();
    }
    this.rooms.clear();
  }

  public get roomCount(): number {
    return this.rooms.size;
  }
}
