from fastapi import FastAPI, WebSocket
from .websocket import websocket_endpoint, game_manager

app = FastAPI()

@app.get("/")
def root():
    return {"message": "ChessLink backend running"}

@app.post("/create-game")
def create_game():
    game = game_manager.create_game()
    return {"game_id": game.id}

@app.post("/join-game")
def join_game(payload: dict):
    game_id = payload.get("game_id")
    player_name = payload.get("player_name")

    if not game_id or not player_name:
        return {"error": "game_id and player_name required"}

    player_id = game_manager.add_player(game_id, player_name)
    if not player_id:
        return {"error": "game full or invalid game_id"}

    return {"player_id": player_id, "game_id": game_id}

@app.websocket("/ws/{game_id}")
async def websocket_route(websocket: WebSocket, game_id: str):
    await websocket_endpoint(websocket, game_id)