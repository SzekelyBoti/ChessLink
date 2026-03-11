from pydantic import BaseModel
from typing import Optional, List


class JoinGameRequest(BaseModel):
    game_id: str
    player_name: str
    device_id: Optional[str] = None

class GameResponse(BaseModel):
    game_id: str

class JoinGameResponse(BaseModel):
    player_name: str
    game_id: str

class GameResultRequest(BaseModel):
    gameId: str
    whiteName: str
    blackName: str
    winner: str 
    reason: str
    moves: int
    timestamp: Optional[str] = None
    moves_list: Optional[List[str]] = None

class ErrorResponse(BaseModel):
    error: str


