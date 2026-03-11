import { useEffect, useState, useRef } from "react";
import {useNavigate, useParams} from "react-router-dom";
import { Chess } from "chess.js";
import Chessground from "@bezalel6/react-chessground";
import "@bezalel6/react-chessground/dist/react-chessground.css";
import API, { WS_URL } from "../../api/config";
import "./Game.css";

function Game() {

    const storedPlayerId = sessionStorage.getItem("playerId");
    const storedPlayerName = sessionStorage.getItem("playerName");
    
    
    const { gameId } = useParams();
    const [chess] = useState(new Chess());
    const [fen, setFen] = useState(chess.fen());
    const [playerColor, setPlayerColor] = useState(null);
    const [gameStatus, setGameStatus] = useState("connecting");
    const [opponentName, setOpponentName] = useState(null);
    const [opponentId, setOpponentId] = useState(null);
    const [playerName, setPlayerName] = useState(storedPlayerName || "Player");
    const [playerId, setPlayerId] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [drawOffered, setDrawOffered] = useState(false);
    const [drawOfferedBy, setDrawOfferedBy] = useState(null);

    const wsRef = useRef(null);
    const mountedRef = useRef(true);
    const connectionEstablished = useRef(false);
    const isConnecting = useRef(false);
    const reconnectAttempts = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 5;
    const navigate = useNavigate();

   

    useEffect(() => {
        mountedRef.current = true;

        setPlayerId(storedPlayerId);
        setPlayerName(storedPlayerName);

        if (!storedPlayerId) {
            console.error("No player ID found in sessionStorage");
            return;
        }

        console.log("=== Game Component Mounted ===");

        if (storedPlayerId && !connectionEstablished.current) {
            connectionEstablished.current = true;
            connectWebSocket(storedPlayerId);
        }

        return () => {
            mountedRef.current = false;
            connectionEstablished.current = false;
            if (wsRef.current) {
                wsRef.current.close(1000, "Component unmounting");
            }
        };
    }, []);

    const connectWebSocket = (pid) => {
        if (isConnecting.current) {
            console.log("Connection already in progress, skipping...");
            return;
        }

        if (!pid) return;

        isConnecting.current = true;

        try {
            const playerName = sessionStorage.getItem("playerName");
            const encodedName = encodeURIComponent(playerName || "");
            const wsUrl = `${WS_URL}/ws/${gameId}?player_id=${pid}&player_name=${encodedName}`;
            console.log("Connecting to WebSocket:", wsUrl);

            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("✅ WebSocket connected");
                setConnectionStatus("connected");
                setGameStatus("waiting");
                isConnecting.current = false;
                reconnectAttempts.current = 0;
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
                isConnecting.current = false;

                if (event.code !== 1000 && mountedRef.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts.current++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
                    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
                    setTimeout(() => connectWebSocket(pid), delay);
                } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
                    console.error("Max reconnection attempts reached");
                    alert("Connection lost. Please refresh the page.");
                }
            };

            socket.onerror = (error) => {
                console.error("WebSocket error:", error);
                isConnecting.current = false;
            };

            wsRef.current = socket;
        } catch (error) {
            console.error("Error creating WebSocket:", error);
            isConnecting.current = false;
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

                    const myName = playerName || sessionStorage.getItem("playerName");
                    const color = message.players[0] === myName ? 'w' : 'b';
                    setPlayerColor(color);
                    
                    console.log(`Color assigned: ${color} for player ${myName}`);

                    const opponent = message.players.find(p => p !== myName);
                    setOpponentName(opponent);

                    if (opponent) {
                        sessionStorage.setItem("opponentName", opponent);
                    }

                    console.log(`Game state - Me: ${myName}, Opponent: ${opponent}, Color: ${color}`);

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

                const myName = playerName || sessionStorage.getItem("playerName");

                const color = message.players[0] === myName ? 'w' : 'b';
                setPlayerColor(color);
                console.log(`Game ready - Color assigned: ${color} for player ${myName}`);

                const opponent = message.players.find(p => p !== myName);
                setOpponentName(opponent);
                sessionStorage.setItem("opponentName", opponent);

                if (opponent) {
                    sessionStorage.setItem("opponentName", opponent);
                }

                console.log(`Game ready - Me: ${myName}, Opponent: ${opponent}, Color: ${color}`);
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
                console.log("Game over:", message);

                const finalOpponentName = opponentName || sessionStorage.getItem("opponentName") || "Unknown";
                const finalPlayerName = playerName || sessionStorage.getItem("playerName") || "Unknown";
                
                let result = "draw";
                let resultReason = message.reason;

                if (message.reason === "checkmate") {
                    result = message.winner === playerId ? "win" : "loss";
                } else if (message.reason === "resignation") {
                    result = message.player === playerId ? "loss" : "win";
                    resultReason = "resignation";
                } else if (message.reason === "stalemate") {
                    result = "draw";
                    resultReason = "stalemate";
                } else if (message.reason === "insufficient_material") {
                    result = "draw";
                    resultReason = "insufficient_material";
                } else if (message.reason === "repetition") {
                    result = "draw";
                    resultReason = "repetition";
                } else if (message.reason === "draw_agreed") {
                    result = "draw";
                    resultReason = "agreement";
                }

                saveGameResult({
                    gameId: gameId,
                    playerId: playerId,
                    playerName: finalPlayerName,
                    opponentId: opponentId,
                    opponentName: finalOpponentName,
                    result: result,
                    reason: resultReason,
                    moves: chess.history().length
                });

                if (message.reason === "checkmate") {
                    alert(`Checkmate! ${message.winner === playerId ? 'You win!' : 'Opponent wins!'}`);
                } else if (message.reason === "stalemate") {
                    alert("Stalemate! Game drawn.");
                } else if (message.reason === "insufficient_material") {
                    alert("Draw by insufficient material!");
                } else if (message.reason === "repetition") {
                    alert("Draw by threefold repetition!");
                } else if (message.reason === "resignation") {
                    alert(message.player === playerId ? "You resigned. Game over!" : "Opponent resigned. You win!");
                } else if (message.reason === "draw_agreed") {
                    alert("Draw agreed! Game ended.");
                }

                setGameStatus("ended");
                setDrawOffered(false);
                setDrawOfferedBy(null);
                break;

            default:
                break;
        }
    };

    const onMove = (orig, dest) => {

        const finalOpponentName = opponentName || sessionStorage.getItem("opponentName") || "Unknown";
        const finalPlayerName = playerName || sessionStorage.getItem("playerName") || "Unknown";
        
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

                if (chess.game_over()) {
                    let result = null;
                    let reason = null;

                    if (chess.in_checkmate()) {
                        const winner = chess.turn() === 'w' ? 'black' : 'white';
                        result = winner === playerColor ? 'win' : 'loss';
                        reason = 'checkmate';
                        alert(`Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins!`);
                    } else if (chess.in_stalemate()) {
                        result = 'draw';
                        reason = 'stalemate';
                        alert('Stalemate! Game drawn.');
                    } else if (chess.in_threefold_repetition()) {
                        result = 'draw';
                        reason = 'repetition';
                        alert('Draw by threefold repetition!');
                    } else if (chess.insufficient_material()) {
                        result = 'draw';
                        reason = 'insufficient_material';
                        alert('Draw by insufficient material!');
                    }

                    if (result) {
                        saveGameResult({
                            gameId: gameId,
                            playerId: playerId,
                            playerName: finalPlayerName,
                            opponentId: opponentId,
                            opponentName: finalOpponentName,
                            result: result,
                            reason: reason,
                            moves: chess.history().length
                        });

                        setGameStatus("ended");
                    }
                }

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
        if (wsRef.current && connectionStatus === "connected") {
            wsRef.current.send(JSON.stringify({
                type: "resign"
            }));
        }
    };

    const handleOfferDraw = () => {
        if (wsRef.current && connectionStatus === "connected") {
            wsRef.current.send(JSON.stringify({
                type: "draw_offer"
            }));
            setDrawOffered(true);
        }
    };

    const handleDrawResponse = (accept) => {
        if (wsRef.current && connectionStatus === "connected") {
            wsRef.current.send(JSON.stringify({
                type: "draw_response",
                response: accept ? "accept" : "decline"
            }));
            setDrawOffered(false);
            setDrawOfferedBy(null);
        }
    };

    const saveGameResult = async (gameData) => {
        try {
            const currentPlayerName = playerName || sessionStorage.getItem("playerName") || "Unknown";
            const currentOpponentName = opponentName || sessionStorage.getItem("opponentName") || "Unknown";

            let whiteName, blackName;

            if (playerColor === 'w') {
                whiteName = currentPlayerName;
                blackName = currentOpponentName;
            } else {
                whiteName = currentOpponentName;
                blackName = currentPlayerName;
            }
            if (whiteName === blackName) {
                console.error("White and black names are the same! This shouldn't happen.");
                if (gameData.whiteName && gameData.blackName) {
                    whiteName = gameData.whiteName;
                    blackName = gameData.blackName;
                }
            }

            let winner = "draw";
            if (gameData.result === "win") {
                winner = playerColor === 'w' ? 'white' : 'black';
            } else if (gameData.result === "loss") {
                winner = playerColor === 'w' ? 'black' : 'white';
            }

            const matchData = {
                gameId: gameData.gameId,
                whiteName: whiteName,
                blackName: blackName,
                winner: winner,
                reason: gameData.reason,
                moves: gameData.moves,
                timestamp: new Date().toISOString()
            };

            console.log("Saving match with data:", matchData);

            const response = await API.post("/save-match", matchData);
            console.log("Match saved successfully:", response.data);
        } catch (error) {
            console.error("Failed to save match:", error);
            if (error.response) {
                console.error("Error response data:", error.response.data);
            }
        }
    };
    
    const getStatusText = () => {
        switch (gameStatus) {
            case "connecting": return "Connecting...";
            case "waiting": return "Waiting for opponent...";
            case "playing": return `Playing as ${playerColor === 'w' ? 'White' : 'Black'}`;
            default: return gameStatus;
        }
    };

    if (!storedPlayerId) {
        return <div className="loading">No player information found. Please join a game first.</div>;
    }

    if (connectionStatus === "disconnected" && gameStatus !== "ended") {
        return <div className="loading">Connecting to game server...</div>;
    }

    return (
        <div className="game-container">
            <div className="game-info">
                <p><strong>Status:</strong> {getStatusText()}</p>
                {opponentName && <p><strong>Opponent:</strong> {opponentName}</p>}
                <p><strong>Turn:</strong> {chess.turn() === 'w' ? 'White' : 'Black'}</p>
            </div>

            <div className="chessboard-wrapper">
                <Chessground
                    width={Math.min(500, window.innerWidth - 40)}
                    height={Math.min(500, window.innerWidth - 40)}
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
                <div className="game-over-container">
                    <div className="game-over-message">
                        <p>Game Over</p>
                    </div>
                    <div className="game-over-buttons">
                        <button
                            className="home-btn"
                            onClick={() => navigate("/")}
                        >
                            Home
                        </button>
                        <button
                            className="reset-btn"
                            onClick={handleReset}
                            disabled={connectionStatus !== "connected"}
                        >
                            New Game
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Game;