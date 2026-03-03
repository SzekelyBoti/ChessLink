from fastapi import WebSocket, WebSocketDisconnect, FastAPI
from typing import Dict, List
from fastapi.middleware.cors import CORSMiddleware

##from sqlalchemy.sql.coercions import except

from .game_manager import GameManager
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)

    def disconnect(self, game_id: str, websocket: WebSocket):
        if game_id in self.active_connections:
            self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]

    async def broadcast(self, game_id: str, message: str):
        for connection in self.active_connections.get(game_id, []):
            await connection.send_text(message)
            
manager = ConnectionManager()
game_manager = GameManager()

async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await manager.connect(game_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            game_manager.add_move(game_id, data)
            await manager.broadcast(game_id, data)
            
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)