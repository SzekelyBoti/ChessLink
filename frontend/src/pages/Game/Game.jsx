import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Chess } from "chess.js";
import Chessground from "@bezalel6/react-chessground";
import "@bezalel6/react-chessground/dist/react-chessground.css";
import { WS_URL } from "../../api/config";
import "./Game.css";

function Game() {
    const { gameId } = useParams();
    const [chess] = useState(new Chess());
    const [fen, setFen] = useState(chess.fen());
    const [playerColor, setPlayerColor] = useState(null);
    const [gameStatus, setGameStatus] = useState("connecting");
    const [opponentName, setOpponentName] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [drawOffered, setDrawOffered] = useState(false);
    const [drawOfferedBy, setDrawOfferedBy] = useState(null);

    const wsRef = useRef(null);
    const mountedRef = useRef(true);
    const connectionEstablished = useRef(false);

    const playerId = sessionStorage.getItem("playerId");

    useEffect(() => {
        mountedRef.current = true;

        if (!playerId) {
            return;
        }

        console.log("=== Game Component Mounted ===");
        
        if (!connectionEstablished.current) {
            connectionEstablished.current = true;
            connectWebSocket();
        }

        return () => {
            mountedRef.current = false;
            connectionEstablished.current = false;
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
                
            case "reset":
                console.log("Opponent reset the board");
                handleReset();
                break;

            case "player_disconnected":
                setGameStatus("waiting");
                break;

            case "draw_offer":
                console.log("Draw offered by:", message.from);
                setDrawOffered(true);
                setDrawOfferedBy(message.from);
                break;

            case "draw_accepted":
                setGameStatus("ended");
                setDrawOffered(false);
                setDrawOfferedBy(null);
                break;

            case "draw_declined":
                setDrawOffered(false);
                setDrawOfferedBy(null);
                break;

            case "game_over":
                setGameStatus("ended");
                setDrawOffered(false);
                setDrawOfferedBy(null);
                break;

            default:
                break;
        }
    };

    const onMove = (orig, dest) => {
        console.log("Move attempted:", orig, "->", dest);

        if (gameStatus !== "playing") {
            return false;
        }

        if (connectionStatus !== "connected") {
            return false;
        }

        if (chess.turn() !== playerColor) {
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
    const handleReset = () => {
        chess.reset();
        setFen(chess.fen());

        if (wsRef.current && connectionStatus === "connected") {
            wsRef.current.send(JSON.stringify({
                type: "reset"
            }));
        }

        setGameStatus("playing");
        setDrawOffered(false);
        setDrawOfferedBy(null);
    };
    const handleResign = () => {
        wsRef.current.send(JSON.stringify({
            type: "resign"
        }));
    };

    const handleOfferDraw = () => {
        wsRef.current.send(JSON.stringify({
            type: "draw_offer"
        }));
        setDrawOffered(true);
    };

    const handleDrawResponse = (accept) => {
        wsRef.current.send(JSON.stringify({
            type: "draw_response",
            response: accept ? "accept" : "decline"
        }));
        setDrawOffered(false);
        setDrawOfferedBy(null);
    };

    const getStatusText = () => {
        switch (gameStatus) {
            case "connecting": return "Connecting...";
            case "waiting": return "Waiting for opponent...";
            case "playing": return `Playing as ${playerColor === 'w' ? 'White' : 'Black'}`;
            default: return gameStatus;
        }
    };

    return (
        <div className="game-container">
            <div className="game-header">
                <h2 className="game-title">Chess Game</h2>
                <div className={`connection-status ${connectionStatus}`}>
                    {connectionStatus === "connected" ? "● Connected" : "● Disconnected"}
                </div>
            </div>

            <div className="game-info">
                <p><strong>Status:</strong> {getStatusText()}</p>
                {opponentName && <p><strong>Opponent:</strong> {opponentName}</p>}
                <p><strong>Turn:</strong> {chess.turn() === 'w' ? 'White' : 'Black'}</p>
            </div>

            <div className="chessboard-wrapper">
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

            <div className="reset-section">
                <button
                    className="reset-btn"
                    onClick={handleReset}
                    disabled={connectionStatus !== "connected"} 
                >
                    New Game
                </button>
            </div>
            {gameStatus === "playing" && !drawOffered &&(
                <div className="game-controls">
                    <button
                        className="control-btn draw-btn"
                        onClick={handleOfferDraw}
                        disabled={drawOffered || connectionStatus !== "connected"}
                    >
                        {drawOffered ? "Draw Offered" : "Offer Draw"}
                    </button>
                    <button
                        className="control-btn resign-btn"
                        onClick={handleResign}
                        disabled={connectionStatus !== "connected"}
                    >
                        Resign
                    </button>
                </div>
            )}

            {drawOffered && drawOfferedBy && drawOfferedBy !== playerId && (
                <div className="draw-prompt">
                    <p>Opponent offers a draw</p>
                    <button
                        className="draw-response-btn accept"
                        onClick={() => handleDrawResponse(true)}
                    >
                        Accept
                    </button>
                    <button
                        className="draw-response-btn decline"
                        onClick={() => handleDrawResponse(false)}
                    >
                        Decline
                    </button>
                </div>
            )}
            {gameStatus === "ended" && (
                <div className="game-over-message">
                    <p>Game Over - Click "New Game" to play again</p>
                </div>
            )}
        </div>
    );
}

export default Game;