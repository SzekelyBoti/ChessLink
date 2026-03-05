import os
import json
import logging
import asyncio
from typing import Dict, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect
from .game_manager import GameManager

logger = logging.getLogger(__name__)

PING_INTERVAL = int(os.getenv("WS_PING_INTERVAL", "30"))  # seconds
CONNECTION_TIMEOUT = int(os.getenv("WS_CONNECTION_TIMEOUT", "60"))  # seconds
MAX_MESSAGE_SIZE = int(os.getenv("WS_MAX_MESSAGE_SIZE", "1024"))  # 1KB

class ConnectionManager:
    """Manages WebSocket connections for all games."""

    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.player_connection_count: Dict[str, Dict[str, int]] = {}
        self.player_tasks: Dict[str, Dict[str, asyncio.Task]] = {}

    async def connect(self, game_id: str, websocket: WebSocket, player_id: str) -> None:
        """Connect a player to a game."""
        if game_id not in self.active_connections:
            self.active_connections[game_id] = {}
            self.player_connection_count[game_id] = {}
            self.player_tasks[game_id] = {}

        if player_id in self.active_connections[game_id]:
            logger.info(f"Player {player_id} already connected to game {game_id}, closing old connection")
            try:
                old_ws = self.active_connections[game_id][player_id]
                if player_id in self.player_tasks[game_id]:
                    self.player_tasks[game_id][player_id].cancel()
                await old_ws.close(code=1000, reason="New connection replacing old")
            except Exception as e:
                logger.error(f"Error closing old connection: {e}")

        self.active_connections[game_id][player_id] = websocket
        self.player_connection_count[game_id][player_id] = self.player_connection_count[game_id].get(player_id, 0) + 1

        self.player_tasks[game_id][player_id] = asyncio.create_task(
            self._heartbeat(game_id, player_id, websocket)
        )

        logger.info(f"Player {player_id} connected to game {game_id} (connection #{self.player_connection_count[game_id][player_id]})")

        await self._notify_players_joined(game_id, player_id)

    async def disconnect(self, game_id: str, player_id: str) -> None:
        """Disconnect a player from a game."""
        if game_id in self.active_connections:
            if game_id in self.player_tasks and player_id in self.player_tasks[game_id]:
                self.player_tasks[game_id][player_id].cancel()
                del self.player_tasks[game_id][player_id]

            if player_id in self.active_connections[game_id]:
                del self.active_connections[game_id][player_id]
                logger.info(f"Player {player_id} disconnected from game {game_id}")

            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
                if game_id in self.player_connection_count:
                    del self.player_connection_count[game_id]
                if game_id in self.player_tasks:
                    del self.player_tasks[game_id]

    async def broadcast(self, game_id: str, message: dict, exclude_player: Optional[str] = None) -> None:
        """Broadcast a message to all players in a game."""
        if game_id not in self.active_connections:
            return

        disconnected = []
        for player_id, websocket in self.active_connections[game_id].items():
            if exclude_player and player_id == exclude_player:
                continue

            try:
                await websocket.send_text(json.dumps(message))
                logger.debug(f"Broadcast to {player_id} in game {game_id}: {message['type']}")
            except Exception as e:
                logger.error(f"Error broadcasting to {player_id} in game {game_id}: {e}")
                disconnected.append(player_id)

        for player_id in disconnected:
            await self.disconnect(game_id, player_id)

    async def send_to_player(self, game_id: str, player_id: str, message: dict) -> bool:
        """Send a message to a specific player."""
        if game_id in self.active_connections and player_id in self.active_connections[game_id]:
            try:
                await self.active_connections[game_id][player_id].send_text(json.dumps(message))
                logger.debug(f"Sent to {player_id} in game {game_id}: {message['type']}")
                return True
            except Exception as e:
                logger.error(f"Error sending to {player_id} in game {game_id}: {e}")
                await self.disconnect(game_id, player_id)
        return False

    async def _heartbeat(self, game_id: str, player_id: str, websocket: WebSocket) -> None:
        """Send periodic heartbeats to keep connection alive."""
        try:
            while True:
                await asyncio.sleep(PING_INTERVAL)
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception as e:
                    logger.info(f"Heartbeat failed for {player_id} in game {game_id}: {e}")
                    break
        except asyncio.CancelledError:
            logger.debug(f"Heartbeat cancelled for {player_id} in game {game_id}")
        except Exception as e:
            logger.error(f"Heartbeat error for {player_id} in game {game_id}: {e}")
        finally:
            await self.disconnect(game_id, player_id)

    async def _notify_players_joined(self, game_id: str, new_player_id: str) -> None:
        """Notify other players that a new player joined."""
        other_players = [
            pid for pid in self.active_connections.get(game_id, {}).keys()
            if pid != new_player_id
        ]

        for other in other_players:
            await self.send_to_player(game_id, other, {
                "type": "player_joined",
                "player_id": new_player_id,
                "players": list(self.active_connections[game_id].keys())
            })

    def get_connected_players(self, game_id: str) -> Set[str]:
        """Get set of connected players in a game."""
        return set(self.active_connections.get(game_id, {}).keys())

manager = ConnectionManager()
game_manager = GameManager()

async def websocket_endpoint(websocket: WebSocket, game_id: str, player_id: str) -> None:
    """Main WebSocket endpoint handler."""

    await websocket.accept()
    logger.info(f"WebSocket accepted for player {player_id} in game {game_id}")

    try:
        game = game_manager.get_game(game_id)
        if not game:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Game not found"
            }))
            await websocket.close(code=1008)
            logger.warning(f"Connection rejected: Game {game_id} not found")
            return

        if player_id not in game.players:
            if len(game.players) >= 2:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Game is full"
                }))
                await websocket.close(code=1008)
                logger.warning(f"Connection rejected: Game {game_id} is full")
                return
            else:
                added = game_manager.add_player(game_id, player_id)
                if not added:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Cannot join game"
                    }))
                    await websocket.close(code=1008)
                    logger.warning(f"Connection rejected: Cannot join game {game_id}")
                    return

        await manager.connect(game_id, websocket, player_id)
        await manager.send_to_player(game_id, player_id, {
            "type": "game_state",
            "players": game.players,
            "moves": game.moves,
            "your_id": player_id,
            "your_color": 'w' if game.players[0] == player_id else 'b'
        })
        if len(game.players) == 2:
            await manager.broadcast(game_id, {
                "type": "game_ready",
                "players": game.players
            })
        async def handle_messages():
            while True:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=CONNECTION_TIMEOUT
                    )
                    if len(data) > MAX_MESSAGE_SIZE:
                        logger.warning(f"Message too large from {player_id}: {len(data)} bytes")
                        continue

                    message = json.loads(data)
                    logger.debug(f"Received from {player_id}: {message.get('type', 'unknown')}")

                    await process_message(message, game_id, player_id, game)

                except asyncio.TimeoutError:
                    try:
                        await websocket.send_text(json.dumps({"type": "ping"}))
                    except:
                        break
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected for player {player_id}")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON from {player_id}: {e}")
                    continue
                except Exception as e:
                    logger.error(f"Error processing message from {player_id}: {e}")
                    continue

        await handle_messages()

    except WebSocketDisconnect:
        logger.info(f"Player {player_id} disconnected from game {game_id}")
    except Exception as e:
        logger.error(f"Unexpected error in websocket_endpoint for {player_id}: {e}")
    finally:
        await manager.disconnect(game_id, player_id)
        try:
            game = game_manager.get_game(game_id)
            if game and len(game.players) == 2:
                await manager.broadcast(game_id, {
                    "type": "player_disconnected",
                    "player_id": player_id
                })
        except Exception as e:
            logger.error(f"Error notifying players of disconnect: {e}")

async def process_message(message: dict, game_id: str, player_id: str, game) -> None:
    """Process different types of WebSocket messages."""

    msg_type = message.get("type")

    if msg_type == "move":
        await handle_move(message, game_id, player_id, game)

    elif msg_type == "ping":
        await manager.send_to_player(game_id, player_id, {"type": "pong"})

    elif msg_type == "resign":
        await handle_resign(game_id, player_id)

    elif msg_type == "draw_offer":
        await handle_draw_offer(game_id, player_id, game)

    elif msg_type == "draw_response":
        await handle_draw_response(message, game_id, player_id)

    else:
        logger.warning(f"Unknown message type from {player_id}: {msg_type}")

async def handle_move(message: dict, game_id: str, player_id: str, game) -> None:
    """Handle a move message."""
    move_data = {
        "from": message.get("from"),
        "to": message.get("to"),
        "promotion": message.get("promotion", "q"),
        "player": player_id,
        "timestamp": message.get("timestamp", 0)
    }
    if not move_data["from"] or not move_data["to"]:
        logger.warning(f"Invalid move data from {player_id}: {move_data}")
        return

    logger.info(f"Processing move from {player_id}: {move_data['from']}->{move_data['to']}")
    game_manager.add_move(game_id, move_data)
    await manager.broadcast(game_id, {
        "type": "move",
        "move": move_data
    }, exclude_player=player_id)

    await manager.send_to_player(game_id, player_id, {
        "type": "move_confirmed",
        "move": move_data
    })

async def handle_resign(game_id: str, player_id: str) -> None:
    """Handle a resign message."""
    logger.info(f"Player {player_id} resigned in game {game_id}")
    await manager.broadcast(game_id, {
        "type": "game_over",
        "reason": "resignation",
        "player": player_id
    })

async def handle_draw_offer(game_id: str, player_id: str, game) -> None:
    """Handle a draw offer message."""
    other_players = [p for p in game.players if p != player_id]
    for other in other_players:
        await manager.send_to_player(game_id, other, {
            "type": "draw_offer",
            "from": player_id
        })

async def handle_draw_response(message: dict, game_id: str, player_id: str) -> None:
    """Handle a draw response message."""
    response = message.get("response")
    if response == "accept":
        await manager.broadcast(game_id, {
            "type": "game_over",
            "reason": "draw_agreed"
        })
    else:
        await manager.broadcast(game_id, {
            "type": "draw_declined",
            "from": player_id
        })