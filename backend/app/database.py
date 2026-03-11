import os
from datetime import datetime
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self, memory_mode=False):
        self.client = None
        self.db = None
        self.memory_mode = memory_mode
        self.memory_server = None

    def connect(self):
        """Connect to MongoDB (real or in-memory)."""
        try:
            if self.memory_mode:
                from .memory_db import MemoryMongoDB
                self.memory_server = MemoryMongoDB()
                self.memory_server.start()
                self.client = self.memory_server.get_client()
                self.db = self.memory_server.get_db()
                logger.info("📊 Connected to in-memory MongoDB")
            else:
                from motor.motor_asyncio import AsyncIOMotorClient
                mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
                self.client = AsyncIOMotorClient(mongodb_uri)
                self.db = self.client['chesslink']

                import asyncio
                loop = asyncio.get_event_loop()
                loop.run_until_complete(self.db.games.create_index("gameId", unique=True))
                loop.run_until_complete(self.db.games.create_index("timestamp"))
                loop.run_until_complete(self.db.games.create_index("whiteName"))
                loop.run_until_complete(self.db.games.create_index("blackName"))
                logger.info(f"📊 Connected to MongoDB at {mongodb_uri}")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def close(self):
        """Close database connection."""
        try:
            if self.memory_mode and self.memory_server:
                self.memory_server.stop()
            elif self.client:
                self.client.close()
            logger.info("📊 MongoDB connection closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")

    def _ensure_db(self):
        """Ensure database is connected."""
        if self.db is None:
            raise Exception("Database not connected. Call connect() first.")
        return True

    def save_game(self, game_data: dict):
        """Save a completed game to database."""
        self._ensure_db()
        games = self.db['games']

        if "timestamp" not in game_data:
            game_data["timestamp"] = datetime.utcnow()

        games.update_one(
            {"gameId": game_data["gameId"]},
            {"$set": game_data},
            upsert=True
        )
        logger.info(f"Game saved: {game_data['gameId']} - {game_data.get('whiteName')} vs {game_data.get('blackName')}")

    def get_recent_matches(self, limit: int = 20) -> List[Dict]:
        """Get recent matches across all players."""
        self._ensure_db()
        games = self.db['games']

        cursor = games.find({}).sort("timestamp", -1).limit(limit)

        matches = []
        for game in cursor:
            game['_id'] = str(game['_id'])
            matches.append(game)

        logger.info(f"Retrieved {len(matches)} recent matches")
        return matches

    def get_player_matches(self, player_name: str, limit: int = 10) -> List[Dict]:
        """Get matches for a specific player by name."""
        self._ensure_db()
        games = self.db['games']

        cursor = games.find({
            "$or": [
                {"whiteName": player_name},
                {"blackName": player_name}
            ]
        }).sort("timestamp", -1).limit(limit)

        matches = []
        for game in cursor:
            game['_id'] = str(game['_id'])
            matches.append(game)

        logger.info(f"Retrieved {len(matches)} matches for player {player_name}")
        return matches

    def get_match_by_id(self, game_id: str) -> Optional[Dict]:
        """Get a specific match by game ID."""
        self._ensure_db()
        games = self.db['games']

        game = games.find_one({"gameId": game_id})
        if game:
            game['_id'] = str(game['_id'])
            return game
        return None
