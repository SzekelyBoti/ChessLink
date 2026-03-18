import os
import asyncio
from datetime import datetime
from typing import Optional, List, Dict
import logging

from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)


class DatabaseService:
    def __init__(self, memory_mode: bool = False):
        self.client = None
        self.db = None
        self.memory_mode = memory_mode
        self.memory_server = None

    async def connect(self):
        """Connect to MongoDB (real or in-memory)."""
        try:
            if self.memory_mode:
                await self._connect_memory()
            else:
                await self._connect_mongo()
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    async def _connect_memory(self):
        """Start and connect to in-memory MongoDB.

        pymongo-inmemory uses a sync pymongo client, so all DB operations
        are run in a thread executor to avoid blocking the event loop.
        """
        from .memory_db import MemoryMongoDB

        self.memory_server = MemoryMongoDB()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.memory_server.start)

        self.client = self.memory_server.get_client()
        self.db = self.memory_server.get_db()
        logger.info("📊 Connected to in-memory MongoDB")

    async def _connect_mongo(self):
        """Connect to a real MongoDB instance via Motor (async)."""
        mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongodb:27017/chesslink")
        self.client = AsyncIOMotorClient(mongodb_uri)
        self.db = self.client["chesslink"]

        await self.db.games.create_index("gameId", unique=True)
        await self.db.games.create_index("timestamp")
        await self.db.games.create_index("whiteName")
        await self.db.games.create_index("blackName")
        await self.db.games.create_index([("whiteName", 1), ("timestamp", -1)])
        await self.db.games.create_index([("blackName", 1), ("timestamp", -1)])

        logger.info(f"📊 Connected to MongoDB at {mongodb_uri}")

    async def close(self):
        """Close database connection."""
        try:
            if self.memory_mode and self.memory_server:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.memory_server.stop)
            elif self.client:
                self.client.close()
            logger.info("📊 MongoDB connection closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")

    def _check_db(self):
        """Raise clearly if the database is not connected."""
        if self.db is None:
            raise RuntimeError("Database not connected — call connect() first")

    async def _run_sync(self, fn, *args, **kwargs):
        """Run a synchronous pymongo call in a thread executor (memory mode only)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def save_game(self, game_data: dict):
        """Save a completed game to database (upsert by gameId)."""
        self._check_db()

        if "timestamp" not in game_data:
            game_data["timestamp"] = datetime.utcnow().isoformat()

        if self.memory_mode:
            await self._run_sync(
                self.db["games"].update_one,
                {"gameId": game_data["gameId"]},
                {"$set": game_data},
                upsert=True,
            )
        else:
            await self.db["games"].update_one(
                {"gameId": game_data["gameId"]},
                {"$set": game_data},
                upsert=True,
            )

        logger.info(f"Game saved: {game_data['gameId']}")

    async def get_recent_matches(self, limit: int = 20) -> List[Dict]:
        """Get recent matches across all players, newest first."""
        self._check_db()

        if self.memory_mode:
            cursor = await self._run_sync(
                lambda: list(
                    self.db["games"].find({}).sort("timestamp", -1).limit(limit)
                )
            )
            matches = cursor
        else:
            cursor = self.db["games"].find({}).sort("timestamp", -1).limit(limit)
            matches = []
            async for game in cursor:
                matches.append(game)

        for game in matches:
            game["_id"] = str(game["_id"])

        return matches

    async def get_player_matches(self, player_name: str, limit: int = 10) -> List[Dict]:
        """Get matches for a specific player by name, newest first."""
        self._check_db()

        query = {
            "$or": [
                {"whiteName": player_name},
                {"blackName": player_name},
            ]
        }

        if self.memory_mode:
            matches = await self._run_sync(
                lambda: list(
                    self.db["games"].find(query).sort("timestamp", -1).limit(limit)
                )
            )
        else:
            cursor = self.db["games"].find(query).sort("timestamp", -1).limit(limit)
            matches = []
            async for game in cursor:
                matches.append(game)

        for game in matches:
            game["_id"] = str(game["_id"])

        return matches

    async def get_match_by_id(self, game_id: str) -> Optional[Dict]:
        """Get a specific match by game ID."""
        self._check_db()

        if self.memory_mode:
            game = await self._run_sync(
                self.db["games"].find_one, {"gameId": game_id}
            )
        else:
            game = await self.db["games"].find_one({"gameId": game_id})

        if game:
            game["_id"] = str(game["_id"])
            return game

        return None
