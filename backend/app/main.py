from datetime import datetime
import os
import logging
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .websocket import websocket_endpoint, game_manager
from .database import DatabaseService
from .models import (
    JoinGameRequest, GameResponse, JoinGameResponse,
    GameResultRequest, ErrorResponse,
)

USE_MEMORY_DB = os.getenv("USE_MEMORY_DB", "true").lower() == "true"
database = DatabaseService(memory_mode=USE_MEMORY_DB)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

app = FastAPI(
    title="ChessLink API",
    description="Multiplayer Chess Game Backend",
    version="1.0.0",
    docs_url="/api/docs" if ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)

@app.on_event("startup")
def startup_event():
    """Connect to database on startup."""
    database.connect()
    logger.info(f"Database connected. DB object: {database.db}")

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "ChessLink Backend",
        "status": "running",
        "environment": ENVIRONMENT,
        "version": "1.0.0"
    }

@app.get("/create-game", response_model=GameResponse)
async def create_game():
    """Create a new chess game."""
    try:
        game = game_manager.create_game()
        logger.info(f"Game created: {game.id}")
        return {"game_id": game.id}
    except Exception as e:
        logger.error(f"Error creating game: {e}")
        raise HTTPException(status_code=500, detail="Failed to create game")

@app.post("/join-game", response_model=JoinGameResponse)
async def join_game(request: JoinGameRequest):
    """Join an existing chess game."""
    try:
        added = game_manager.add_player_by_name(request.game_id, request.player_name)

        if not added:
            raise HTTPException(
                status_code=400,
                detail="Game is full or invalid game ID"
            )

        logger.info(f"Player {request.player_name} joined game {request.game_id}")
        return {
            "player_name": request.player_name,
            "game_id": request.game_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining game: {e}")
        raise HTTPException(status_code=500, detail="Failed to join game")

@app.websocket("/ws/{game_id}")
async def websocket_route(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for real-time game communication."""
    player_id = websocket.query_params.get("player_id")
    player_name = websocket.query_params.get("player_name")

    if not player_id:
        logger.warning(f"WebSocket connection rejected: missing player_id for game {game_id}")
        await websocket.close(code=1008, reason="player_id required")
        return

    logger.info(f"WebSocket connection attempt - Player: {player_id} ({player_name}), Game: {game_id}")

    try:
        await websocket_endpoint(websocket, game_id, player_id, player_name)
    except Exception as e:
        logger.error(f"WebSocket error for player {player_id} in game {game_id}: {e}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass
@app.post("/save-match")
async def save_match(request: GameResultRequest):
    """Save a completed match to database."""
    try:
        logger.info(f"Saving match: {request.gameId} - {request.whiteName} vs {request.blackName}")

        match_data = {
            "gameId": request.gameId,
            "whiteName": request.whiteName,
            "blackName": request.blackName,
            "winner": request.winner,
            "reason": request.reason,
            "moves": request.moves,
            "timestamp": request.timestamp or datetime.utcnow().isoformat()
        }

        if request.moves_list:
            match_data["moves_list"] = request.moves_list

        database.save_game(match_data)

        return {"status": "success", "message": "Match saved successfully"}

    except Exception as e:
        logger.error(f"Error saving match: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/matches/recent")
async def get_recent_matches(limit: int = 20):
    """Get recent matches across all players."""
    matches = database.get_recent_matches(limit)
    return {"matches": matches}

@app.get("/player/{player_name}/matches")
async def get_player_matches(player_name: str, limit: int = 10):
    """Get matches for a specific player by name."""
    matches = database.get_player_matches(player_name, limit)
    return {"matches": matches}

@app.get("/health")
async def health_check():
    """Kubernetes health check endpoint."""
    return {"status": "healthy"}

@app.get("/ready")
async def readiness_check():
    """Kubernetes readiness check endpoint."""
    return {"status": "ready"}

@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint."""
    return {
        "active_games": game_manager.get_game_count(),
        "total_games": len(game_manager.games),
    }
