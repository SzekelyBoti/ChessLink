import uuid
import chess
from typing import Dict, List, Any, Optional, Union
import logging

logger = logging.getLogger(__name__)

class Game:
    """Represents a single chess game instance."""

    def __init__(self):
        self.id = str(uuid.uuid4())
        self.players: List[Union[str, Dict[str, str]]] = []
        self.moves: List[Dict[str, Any]] = []
        self.board = chess.Board()
        self.created_at = None
        self.last_activity = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert game to dictionary for API responses."""
        player_names = []
        for player in self.players:
            if isinstance(player, dict):
                player_names.append(player.get("name", str(player)))
            else:
                player_names.append(player)

        return {
            "id": self.id,
            "players": player_names,
            "moves": self.moves,
            "player_count": len(self.players)
        }

class GameManager:
    """Manages all active chess games."""

    def __init__(self):
        self.games: Dict[str, Game] = {}
        logger.info("GameManager initialized")

    def create_game(self) -> Game:
        """Create a new game and return it."""
        game = Game()
        self.games[game.id] = game
        logger.info(f"Game created: {game.id}")
        return game

    def get_game(self, game_id: str) -> Optional[Game]:
        """Get a game by ID, returns None if not found."""
        game = self.games.get(game_id)
        if not game:
            logger.warning(f"Game not found: {game_id}")
        return game

    def add_player_by_name(self, game_id: str, player_name: str) -> Optional[str]:
        """Add a player by name only (temporary until WebSocket connection)."""
        game = self.get_game(game_id)

        if not game:
            logger.warning(f"Cannot add player to non-existent game: {game_id}")
            return None

        if len(game.players) >= 2:
            logger.warning(f"Game {game_id} is full, cannot add player {player_name}")
            return None

        game.players.append({
            "id": f"temp_{player_name}",
            "name": player_name
        })

        logger.info(f"Player {player_name} added to game {game_id} (temp ID)")
        return player_name

    def update_player_id(self, game_id: str, temp_name: str, real_id: str) -> bool:
        """Update a player's temporary ID with their real device ID."""
        game = self.get_game(game_id)
        if not game:
            return False

        for i, player in enumerate(game.players):
            if isinstance(player, dict) and player.get("name") == temp_name:
                game.players[i] = {
                    "id": real_id,
                    "name": player["name"]
                }
                logger.info(f"Updated player {temp_name} with real ID {real_id}")
                return True

        return False

    def add_player(self, game_id: str, player_id: str, player_name: str) -> Optional[str]:
        """Add a player with full ID (used by WebSocket)."""
        game = self.get_game(game_id)

        if not game:
            logger.warning(f"Cannot add player to non-existent game: {game_id}")
            return None

        for i, player in enumerate(game.players):
            if isinstance(player, dict) and player.get("id") == player_id:
                if player.get("name") != player_name:
                    game.players[i]["name"] = player_name
                    logger.info(f"Updated player {player_id} name to {player_name}")
                return player_id

        for i, player in enumerate(game.players):
            if isinstance(player, dict) and player.get("name") == player_name and player.get("id", "").startswith("temp_"):
                game.players[i] = {
                    "id": player_id,
                    "name": player_name
                }
                logger.info(f"Updated temp player {player_name} with ID {player_id}")
                return player_id
            
        if len(game.players) >= 2:
            logger.warning(f"Game {game_id} is full, cannot add player {player_name}")
            return None

        game.players.append({
            "id": player_id,
            "name": player_name
        })

        logger.info(f"Player {player_id} ({player_name}) added to game {game_id}")
        return player_id

    def get_player_name(self, game_id: str, player_id: str) -> Optional[str]:
        """Get a player's display name by their ID."""
        game = self.get_game(game_id)
        if not game:
            return None

        for player in game.players:
            if isinstance(player, dict) and player.get("id") == player_id:
                return player.get("name")
        return None

    def get_player_ids(self, game_id: str) -> List[str]:
        """Get list of player IDs for a game."""
        game = self.get_game(game_id)
        if not game:
            return []

        ids = []
        for player in game.players:
            if isinstance(player, dict):
                ids.append(player.get("id", ""))
            else:
                ids.append(player)
        return ids

    def get_player_names(self, game_id: str) -> List[str]:
        """Get list of player names for a game."""
        game = self.get_game(game_id)
        if not game:
            return []

        names = []
        for player in game.players:
            if isinstance(player, dict):
                names.append(player.get("name", ""))
            else:
                names.append(player)
        return names

    def add_move(self, game_id: str, move: Dict[str, Any]) -> bool:
        """Add a move to a game. Returns True if successful."""
        game = self.get_game(game_id)

        if not game:
            logger.warning(f"Cannot add move to non-existent game: {game_id}")
            return False

        game.moves.append(move)
        logger.info(f"Move added to game {game_id}: {move.get('from')}->{move.get('to')}")
        return True

    def remove_game(self, game_id: str) -> bool:
        """Remove a game (for cleanup)."""
        if game_id in self.games:
            del self.games[game_id]
            logger.info(f"Game removed: {game_id}")
            return True
        return False

    def get_game_count(self) -> int:
        """Get number of active games."""
        return len(self.games)

    def is_game_ready(self, game_id: str) -> bool:
        """Check if a game has two players and is ready to start."""
        game = self.get_game(game_id)
        if not game:
            return False
        return len(game.players) == 2

    def get_player_color(self, game_id: str, player_id: str) -> Optional[str]:
        """Get the color ('w' or 'b') for a player in a game."""
        game = self.get_game(game_id)
        if not game:
            return None

        player_ids = self.get_player_ids(game_id)
        if len(player_ids) < 2:
            return None

        if player_ids[0] == player_id:
            return 'w'
        elif player_ids[1] == player_id:
            return 'b'
        return None

    def remove_player(self, game_id: str, player_id: str) -> bool:
        """Remove a player from a game (when they disconnect)."""
        game = self.get_game(game_id)
        if not game:
            return False

        for i, player in enumerate(game.players):
            if isinstance(player, dict) and player.get("id") == player_id:
                game.players.pop(i)
                logger.info(f"Player {player_id} removed from game {game_id}")
                return True
            elif player == player_id:
                game.players.pop(i)
                logger.info(f"Player {player_id} removed from game {game_id}")
                return True

        return False

    def can_add_player(self, game_id: str) -> bool:
        """Check if a player can be added to a game."""
        game = self.get_game(game_id)
        if not game:
            return False
        return len(game.players) < 2
        