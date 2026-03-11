import logging
from pymongo_inmemory import MongoClient as InMemoryClient

logger = logging.getLogger(__name__)

class MemoryMongoDB:
    """In-memory MongoDB for development/testing using pymongo-inmemory."""

    def __init__(self):
        self.client = None
        self.db = None

    def start(self):
        """Start in-memory MongoDB server."""
        try:
            self.client = InMemoryClient()
            self.db = self.client['chesslink']
            logger.info("📊 In-memory MongoDB started successfully")

            self.db.games.create_index("gameId", unique=True)
            self.db.games.create_index("timestamp")
            self.db.games.create_index("whiteName")
            self.db.games.create_index("blackName")

            self.db.games.create_index([
                ("whiteName", 1),
                ("timestamp", -1)
            ])
            self.db.games.create_index([
                ("blackName", 1),
                ("timestamp", -1)
            ])

            logger.info("Database indexes created")

        except Exception as e:
            logger.error(f"Failed to start in-memory MongoDB: {e}")
            raise

    def stop(self):
        """Stop in-memory MongoDB server."""
        if self.client:
            self.client.close()
            logger.info("📊 In-memory MongoDB stopped")

    def get_client(self):
        return self.client

    def get_db(self):
        return self.db