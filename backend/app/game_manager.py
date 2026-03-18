import uuid
import chess
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)


class Game:
    """Represents a single chess game instance."""

    def __init__(self):
        self.id = str(uuid.uuid4())
        self.players: List[Dict[str, str]] = []
        self.moves: List[Dict[str, Any]] = []
        self.board = chess.Board()
        self.created_at: datetime = datetime.utcnow()
        self.last_activity: datetime = datetime.utcnow()

    def touch(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert game to dictionary for API responses."""
        return {
            "id": self.id,
            "players": [p.get("name", "") for p in self.players],
            "moves": self.moves,
            "player_count": len(self.players),
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
        }


class GameManager:
    """Manages all active chess games."""

    def __init__(self):
        self.games: Dict[str, Game] = {}
        logger.info("GameManager initialized")

    # ------------------------------------------------------------------
    # Game lifecycle
    # ------------------------------------------------------------------

    def create_game(self) -> Game:
        """Create a new game and return it."""
        game = Game()
        self.games[game.id] = game
        logger.info(f"Game created: {game.id}")
        return game

    def get_game(self, game_id: str) -> Optional[Game]:
        """Return a game by ID, or None if not found."""
        game = self.games.get(game_id)
        if not game:
            logger.warning(f"Game not found: {game_id}")
        return game

    def remove_game(self, game_id: str) -> bool:
        """Remove a game (cleanup)."""
        if game_id in self.games:
            del self.games[game_id]
            logger.info(f"Game removed: {game_id}")
            return True
        return False

    def get_game_count(self) -> int:
        """Return number of active games."""
        return len(self.games)

    # ------------------------------------------------------------------
    # Player management
    # ------------------------------------------------------------------

    def add_player_by_name(self, game_id: str, player_name: str) -> Optional[str]:
        """Add a player by name only (temporary until WebSocket connects).

        Returns player_name on success, None on failure.
        """
        game = self.get_game(game_id)
        if not game:
            logger.warning(f"Cannot add player to non-existent game: {game_id}")
            return None

        if len(game.players) >= 2:
            logger.warning(f"Game {game_id} is full, cannot add {player_name}")
            return None

        if any(p.get("name") == player_name for p in game.players):
            logger.warning(f"Player name '{player_name}' already in game {game_id}")
            return None

        game.players.append({"id": f"temp_{player_name}", "name": player_name})
        game.touch()
        logger.info(f"Player '{player_name}' added to game {game_id} (temp ID)")
        return player_name

    def add_player(self, game_id: str, player_id: str, player_name: str) -> Optional[str]:
        """Add or update a player with their real device ID (called by WebSocket).

        Handles three cases:
        1. Player ID already exists → update name if changed.
        2. Matching temp entry (name matches, id starts with 'temp_') → upgrade to real ID.
        3. New player → append if there's room.

        Returns player_id on success, None on failure.
        """
        game = self.get_game(game_id)
        if not game:
            logger.warning(f"Cannot add player to non-existent game: {game_id}")
            return None

        # Case 1: real ID already present
        for i, player in enumerate(game.players):
            if player.get("id") == player_id:
                if player.get("name") != player_name:
                    game.players[i]["name"] = player_name
                    logger.info(f"Updated name for player {player_id} → '{player_name}'")
                game.touch()
                return player_id

        # Case 2: matching temp entry
        for i, player in enumerate(game.players):
            if (
                    player.get("name") == player_name
                    and str(player.get("id", "")).startswith("temp_")
            ):
                game.players[i] = {"id": player_id, "name": player_name}
                game.touch()
                logger.info(f"Upgraded temp player '{player_name}' → ID {player_id}")
                return player_id

        # Case 3: new player
        if len(game.players) >= 2:
            logger.warning(f"Game {game_id} is full, cannot add {player_name}")
            return None

        game.players.append({"id": player_id, "name": player_name})
        game.touch()
        logger.info(f"Player {player_id} ('{player_name}') added to game {game_id}")
        return player_id

    def update_player_id(self, game_id: str, temp_name: str, real_id: str) -> bool:
        """Update a player's temporary ID with their real device ID."""
        game = self.get_game(game_id)
        if not game:
            return False

        for i, player in enumerate(game.players):
            if player.get("name") == temp_name:
                game.players[i] = {"id": real_id, "name": player["name"]}
                game.touch()
                logger.info(f"Updated player '{temp_name}' with real ID {real_id}")
                return True

        return False

    def remove_player(self, game_id: str, player_id: str) -> bool:
        """Remove a player from a game (on disconnect)."""
        game = self.get_game(game_id)
        if not game:
            return False

        for i, player in enumerate(game.players):
            if player.get("id") == player_id:
                game.players.pop(i)
                game.touch()
                logger.info(f"Player {player_id} removed from game {game_id}")
                return True

        return False

    # ------------------------------------------------------------------
    # Player queries
    # ------------------------------------------------------------------

    def get_player_ids(self, game_id: str) -> List[str]:
        """Return list of player IDs for a game."""
        game = self.get_game(game_id)
        if not game:
            return []
        return [p.get("id", "") for p in game.players]

    def get_player_names(self, game_id: str) -> List[str]:
        """Return list of player names for a game."""
        game = self.get_game(game_id)
        if not game:
            return []
        return [p.get("name", "") for p in game.players]

    def get_player_name(self, game_id: str, player_id: str) -> Optional[str]:
        """Return a player's display name by their ID."""
        game = self.get_game(game_id)
        if not game:
            return None
        for player in game.players:
            if player.get("id") == player_id:
                return player.get("name")
        return None

    def get_player_color(self, game_id: str, player_id: str) -> Optional[str]:
        """Return 'w' or 'b' for a player. First player added is always white."""
        ids = self.get_player_ids(game_id)
        if len(ids) < 1:
            return None
        if ids[0] == player_id:
            return "w"
        if len(ids) > 1 and ids[1] == player_id:
            return "b"
        return None

    # ------------------------------------------------------------------
    # Game state
    # ------------------------------------------------------------------

    def add_move(self, game_id: str, move: Dict[str, Any]) -> bool:
        """Append a move to a game's move list. Returns True on success."""
        game = self.get_game(game_id)
        if not game:
            logger.warning(f"Cannot add move to non-existent game: {game_id}")
            return False

        game.moves.append(move)
        game.touch()
        logger.info(f"Move added to game {game_id}: {move.get('from')}->{move.get('to')}")
        return True

    def is_game_ready(self, game_id: str) -> bool:
        """Return True if two players have joined."""
        game = self.get_game(game_id)
        return bool(game and len(game.players) == 2)

    def can_add_player(self, game_id: str) -> bool:
        """Return True if there is still room for a player."""
        game = self.get_game(game_id)
        return bool(game and len(game.players) < 2)
        