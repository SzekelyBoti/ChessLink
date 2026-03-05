import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Chess } from "chess.js";
import Chessground from "@bezalel6/react-chessground";
import "@bezalel6/react-chessground/dist/react-chessground.css";
import { WS_URL } from "../api/config";

function Game() {
    const { gameId } = useParams();
    const [chess] = useState(new Chess());
    const [fen, setFen] = useState(chess.fen());
    const [playerColor, setPlayerColor] = useState(null);
    const [gameStatus, setGameStatus] = useState("connecting");
    const [opponentName, setOpponentName] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("disconnected");

    const wsRef = useRef(null);
    const mountedRef = useRef(true);

    const playerId = sessionStorage.getItem("playerId");

    useEffect(() => {
        mountedRef.current = true;

        if (!playerId) {
            alert("No player ID found. Please join the game first.");
            return;
        }

        console.log("=== Game Component Mounted ===");
        connectWebSocket();

        return () => {
            mountedRef.current = false;
            if (wsRef.current) {
                wsRef.current.close(1000, "Component unmounting");
            }
        };
    }, []);

    const connectWebSocket = () => {
        try {
            const wsUrl = `${WS_URL}/ws/${gameId}?player_id=${playerId}`;
            console.log("Connecting to WebSocket:", wsUrl);

            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("✅ WebSocket connected");
                setConnectionStatus("connected");
                setGameStatus("waiting");
                socket.send(JSON.stringify({ type: "ping" }));
            };

            socket.onmessage = (e) => {
                try {
                    const message = JSON.parse(e.data);
                    handleWebSocketMessage(message);
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            };

            socket.onclose = (event) => {
                console.log("WebSocket closed:", event.code);
                setConnectionStatus("disconnected");
                if (event.code !== 1000 && mountedRef.current) {
                    setTimeout(connectWebSocket, 3000);
                }
            };

            socket.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            wsRef.current = socket;
        } catch (error) {
            console.error("Error creating WebSocket:", error);
        }
    };
    
    const getLegalMoves = () => {
        if (gameStatus !== "playing") return new Map();

        const dests = new Map();
        const moves = chess.moves({ verbose: true });

        moves.forEach(move => {
            if (!dests.has(move.from)) {
                dests.set(move.from, []);
            }
            dests.get(move.from).push(move.to);
        });

        return dests;
    };

    const handleWebSocketMessage = (message) => {
        console.log("Received:", message.type);

        switch (message.type) {
            case "game_state":
                if (message.players && message.players.length === 2) {
                    setGameStatus("playing");
                    const color = message.players[0] === playerId ? 'w' : 'b';
                    setPlayerColor(color);

                    const opponent = message.players.find(p => p !== playerId);
                    setOpponentName(opponent);

                    // Load existing moves
                    chess.reset();
                    if (message.moves && message.moves.length > 0) {
                        message.moves.forEach(moveData => {
                            try {
                                chess.move({
                                    from: moveData.from,
                                    to: moveData.to,
                                    promotion: moveData.promotion || 'q'
                                });
                            } catch (e) {
                                console.error("Error loading move:", e);
                            }
                        });
                    }
                    setFen(chess.fen());
                }
                break;

            case "game_ready":
                setGameStatus("playing");
                const color = message.players[0] === playerId ? 'w' : 'b';
                setPlayerColor(color);
                const opponent = message.players.find(p => p !== playerId);
                setOpponentName(opponent);
                break;

            case "player_joined":
                if (message.players && message.players.length === 2) {
                    setGameStatus("playing");
                }
                break;

            case "move":
                console.log("Opponent move:", message.move);
                try {
                    const move = chess.move({
                        from: message.move.from,
                        to: message.move.to,
                        promotion: message.move.promotion || 'q'
                    });

                    if (move) {
                        setFen(chess.fen());
                    }
                } catch (e) {
                    console.error("Error applying move:", e);
                }
                break;

            case "player_disconnected":
                setGameStatus("waiting");
                alert("Opponent disconnected");
                break;

            case "pong":
                break;

            default:
                break;
        }
    };

    const onMove = (orig, dest) => {
        console.log("Move attempted:", orig, "->", dest);
        
        if (gameStatus !== "playing") {
            alert("Waiting for opponent...");
            return false;
        }

        if (connectionStatus !== "connected") {
            alert("Not connected to server");
            return false;
        }

        if (chess.turn() !== playerColor) {
            alert("Not your turn!");
            return false;
        }
        
        try {
            const move = chess.move({
                from: orig,
                to: dest,
                promotion: 'q'
            });

            if (move) {
                console.log("Move successful:", move);
                setFen(chess.fen());
                
                wsRef.current.send(JSON.stringify({
                    type: "move",
                    from: orig,
                    to: dest,
                    promotion: "q",
                    timestamp: Date.now()
                }));

                return true;
            }
        } catch (error) {
            console.error("Move error:", error);
        }
        return false;
    };

    return (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px" }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                padding: "10px",
                backgroundColor: "#f5f5f5",
                borderRadius: "5px"
            }}>
                <h2 style={{ margin: 0 }}>Chess Game</h2>
                <div style={{
                    padding: "5px 10px",
                    borderRadius: "5px",
                    backgroundColor: connectionStatus === "connected" ? "#4CAF50" : "#f44336",
                    color: "white",
                    fontSize: "14px"
                }}>
                    {connectionStatus === "connected" ? "● Connected" : "● Disconnected"}
                </div>
            </div>

            <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f0f0f0", borderRadius: "5px" }}>
                <p><strong>Status:</strong> {
                    gameStatus === "connecting" ? "Connecting..." :
                        gameStatus === "waiting" ? "Waiting for opponent..." :
                            gameStatus === "playing" ? `Playing as ${playerColor === 'w' ? 'White' : 'Black'}` :
                                gameStatus
                }</p>
                {opponentName && <p><strong>Opponent:</strong> {opponentName}</p>}
                <p><strong>Turn:</strong> {chess.turn() === 'w' ? 'White' : 'Black'}</p>
            </div>

            <div style={{ width: "100%", aspectRatio: "1/1" }}>
                <Chessground
                    width={500}
                    height={500}
                    fen={fen}
                    orientation={playerColor === 'b' ? 'black' : 'white'}
                    onMove={onMove}
                    movable={{
                        free: false,
                        color: gameStatus === "playing" && chess.turn() === playerColor
                            ? (playerColor === 'w' ? 'white' : 'black')
                            : undefined,
                        dests: getLegalMoves()
                    }}
                    turnColor={chess.turn() === 'w' ? 'white' : 'black'}
                />
            </div>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button
                    onClick={() => {
                        chess.reset();
                        setFen(chess.fen());
                    }}
                    style={{ padding: "10px 20px", fontSize: "16px" }}
                >
                    Reset Board
                </button>
            </div>
        </div>
    );
}

export default Game;