import uuid
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

class Game:
    """Represents a single chess game instance."""

    def __init__(self):
        self.id = str(uuid.uuid4())
        self.players: List[str] = []
        self.moves: List[Dict[str, Any]] = []
        self.created_at = None
        self.last_activity = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert game to dictionary for API responses."""
        return {
            "id": self.id,
            "players": self.players,
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

    def add_player(self, game_id: str, player_name: str) -> Optional[str]:
        """Add a player to a game. Returns player_name if successful, None otherwise."""
        game = self.get_game(game_id)

        if not game:
            logger.warning(f"Cannot add player to non-existent game: {game_id}")
            return None

        if len(game.players) >= 2:
            logger.warning(f"Game {game_id} is full, cannot add player {player_name}")
            return None

        game.players.append(player_name)
        logger.info(f"Player {player_name} added to game {game_id}")
        return player_name

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

    def cleanup_old_games(self, max_age_hours: int = 24):
        pass
        