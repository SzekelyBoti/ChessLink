import uuid
from typing import Dict, List

class Game:
    def __init__(self):
        self.id = str(uuid.uuid4())
        self.players: List[str] = []
        self.moves: List[str] = []
        
class GameManager:
    def __init__(self):
        self.games: Dict[str, Game] = {}
        
    def create_game(self) -> Game:
        game = Game()
        self.games[game.id] = game
        return game
    
    def get_game(self, game_id: str) -> Game:
        return self.games.get(game_id)
    
    def add_player(self, game_id: str,player_id: str):
        game = self.get_game(game_id)
        if game and len(game.players) < 2:
            game.players.append(player_id)
            return True
        return False
    
    def add_move(self, game_id: str, move: str):
        game = self.get_game(game_id)
        if game:
            game.moves.append(move)
        