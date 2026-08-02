import { io, type Socket } from "socket.io-client";
import type { ReactionCreatedEvent, SlideDestroyedEvent } from "./effect-types";

type ReactionRealtimeHandlers = {
  onReaction: (event: ReactionCreatedEvent) => void;
  onDestroyed: (event: SlideDestroyedEvent) => void;
};

export class ReactionRealtimeClient {
  private readonly socket: Socket;

  constructor(roomId: string, handlers: ReactionRealtimeHandlers) {
    this.socket = io({
      transports: ["websocket"],
      reconnectionAttempts: 3,
      timeout: 3000,
    });
    this.socket.on("connect", () => {
      this.socket.emit("room:join", { roomId });
    });
    this.socket.on("presentation:reaction-created", handlers.onReaction);
    this.socket.on("presentation:slide-destroyed", handlers.onDestroyed);
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
