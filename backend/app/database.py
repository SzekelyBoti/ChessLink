import os
from datetime import datetime
from typing import Optional, List, Dict
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self, memory_mode=False):
        self.client = None
        self.db = None
        self.memory_mode = memory_mode
        self.memory_server = None

    async def connect(self):
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
                mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongodb:27017/chesslink")
                self.client = AsyncIOMotorClient(mongodb_uri)
                self.db = self.client['chesslink']

                # Create indexes
                await self.db.games.create_index("gameId", unique=True)
                await self.db.games.create_index("timestamp")
                await self.db.games.create_index("whiteName")
                await self.db.games.create_index("blackName")

                logger.info(f"📊 Connected to MongoDB at {mongodb_uri}")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    async def close(self):
        """Close database connection."""
        try:
            if self.memory_mode and self.memory_server:
                self.memory_server.stop()
            elif self.client:
                self.client.close()
            logger.info("📊 MongoDB connection closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")

    async def save_game(self, game_data: dict):
        """Save a completed game to database."""
        if self.db is None:
            raise Exception("Database not connected")

        games = self.db['games']
        if "timestamp" not in game_data:
            game_data["timestamp"] = datetime.utcnow()

        await games.update_one(
            {"gameId": game_data["gameId"]},
            {"$set": game_data},
            upsert=True
        )
        logger.info(f"Game saved: {game_data['gameId']}")

    async def get_recent_matches(self, limit: int = 20) -> List[Dict]:
        """Get recent matches across all players."""
        if self.db is None:
            raise Exception("Database not connected")

        games = self.db['games']
        cursor = games.find({}).sort("timestamp", -1).limit(limit)

        matches = []
        async for game in cursor:
            game['_id'] = str(game['_id'])
            matches.append(game)

        return matches

    async def get_player_matches(self, player_name: str, limit: int = 10) -> List[Dict]:
        """Get matches for a specific player by name."""
        if self.db is None:
            raise Exception("Database not connected")

        games = self.db['games']
        cursor = games.find({
            "$or": [
                {"whiteName": player_name},
                {"blackName": player_name}
            ]
        }).sort("timestamp", -1).limit(limit)

        matches = []
        async for game in cursor:
            game['_id'] = str(game['_id'])
            matches.append(game)

        return matches

    async def get_match_by_id(self, game_id: str) -> Optional[Dict]:
        """Get a specific match by game ID."""
        if self.db is None:
            raise Exception("Database not connected")

        games = self.db['games']
        game = await games.find_one({"gameId": game_id})
        if game:
            game['_id'] = str(game['_id'])
            return game
        return None
