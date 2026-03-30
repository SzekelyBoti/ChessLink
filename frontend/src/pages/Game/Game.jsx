import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import Chessground from "@bezalel6/react-chessground";
import "@bezalel6/react-chessground/dist/react-chessground.css";
import API, { WS_URL } from "../../api/config";
import "./Game.css";

const MAX_RECONNECT_ATTEMPTS = 5;

function Game() {
    const { gameId } = useParams();
    const navigate   = useNavigate();
    const chessRef = useRef(new Chess());

    const storedPlayerId   = sessionStorage.getItem("playerId");
    const storedPlayerName = sessionStorage.getItem("playerName");

    const [fen,            setFen]            = useState(() => chessRef.current.fen());
    const [playerColor,    setPlayerColor]    = useState(null);
    const [gameStatus,     setGameStatus]     = useState("connecting");
    const [opponentName,   setOpponentName]   = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [drawOffered,    setDrawOffered]    = useState(false);
    const [drawOfferedBy,  setDrawOfferedBy]  = useState(null);
    const [gameOverInfo,   setGameOverInfo]   = useState(null);

    // Refs used inside callbacks (avoid stale closures)
    const wsRef                = useRef(null);
    const mountedRef           = useRef(true);
    const connectionEstablished = useRef(false);
    const isConnecting         = useRef(false);
    const reconnectAttempts    = useRef(0);
    const playerColorRef       = useRef(null);
    const opponentNameRef      = useRef(null);
    const gameSavedRef         = useRef(false);

    // Keep refs in sync with state
    useEffect(() => { playerColorRef.current  = playerColor;  }, [playerColor]);
    useEffect(() => { opponentNameRef.current = opponentName; }, [opponentName]);

    // ------------------------------------------------------------------
    // Save game result — called only once per game (guarded by gameSavedRef)
    // ------------------------------------------------------------------
    const saveGameResult = useCallback(async ({ result, reason, moves }) => {
        if (gameSavedRef.current) return;
        gameSavedRef.current = true;

        const myName       = sessionStorage.getItem("playerName") || "Unknown";
        const oppName      = opponentNameRef.current
            || sessionStorage.getItem("opponentName")
            || "Unknown";
        const color        = playerColorRef.current;

        const whiteName = color === "w" ? myName  : oppName;
        const blackName = color === "w" ? oppName : myName;

        if (whiteName === blackName) {
            console.error("White and black names are identical — skipping save.");
            return;
        }

        let winner = "draw";
        if (result === "win")  winner = color === "w" ? "white" : "black";
        if (result === "loss") winner = color === "w" ? "black" : "white";

        const matchData = {
            gameId,
            whiteName,
            blackName,
            winner,
            reason,
            moves,
            timestamp: new Date().toISOString(),
        };

        try {
            const response = await API.post("/save-match", matchData);
            console.log("Match saved:", response.data);
        } catch (error) {
            console.error("Failed to save match:", error.response?.data ?? error);
        }
    }, [gameId]);

    // ------------------------------------------------------------------
    // WebSocket message handler
    // ------------------------------------------------------------------
    const handleWebSocketMessage = useCallback((message) => {
        console.log("Received:", message.type);
        const chess = chessRef.current;

        switch (message.type) {

            case "game_state": {
                if (message.your_color) {
                    setPlayerColor(message.your_color);
                    playerColorRef.current = message.your_color;
                }

                if (message.players && message.players.length === 2) {
                    setGameStatus("playing");
                    const myName  = sessionStorage.getItem("playerName");
                    const opp     = message.players.find(p => p !== myName) || null;
                    setOpponentName(opp);
                    opponentNameRef.current = opp;
                    if (opp) sessionStorage.setItem("opponentName", opp);
                } else {
                    setGameStatus("waiting");
                }

                chess.reset();
                (message.moves || []).forEach(moveData => {
                    try {
                        chess.move({
                            from:      moveData.from,
                            to:        moveData.to,
                            promotion: moveData.promotion || "q",
                        });
                    } catch (e) {
                        console.error("Error replaying move:", e);
                    }
                });
                setFen(chess.fen());

                setGameOverInfo(null);
                setDrawOffered(false);
                setDrawOfferedBy(null);
                gameSavedRef.current = false;
                break;
            }

            case "game_ready": {
                setGameStatus("playing");
                if (message.players) {
                    const myName = sessionStorage.getItem("playerName");
                    const opp    = message.players.find(p => p !== myName) || null;
                    setOpponentName(opp);
                    opponentNameRef.current = opp;
                    if (opp) sessionStorage.setItem("opponentName", opp);
                }
                break;
            }

            case "player_joined": {
                if (message.players && message.players.length === 2) {
                    setGameStatus("playing");
                }
                break;
            }

            case "move": {
                try {
                    const move = chess.move({
                        from:      message.move.from,
                        to:        message.move.to,
                        promotion: message.move.promotion || "q",
                    });
                    if (move) setFen(chess.fen());
                } catch (e) {
                    console.error("Error applying opponent move:", e);
                }
                break;
            }

            case "reset":
                break;

            case "player_disconnected": {
                setGameStatus("waiting");
                break;
            }

            case "draw_offer": {
                setDrawOffered(true);
                setDrawOfferedBy(message.from);
                break;
            }

            case "draw_declined": {
                setDrawOffered(false);
                setDrawOfferedBy(null);
                break;
            }

            case "game_over": {
                const reason = message.reason;
                let result   = "draw";
                let display  = "";

                if (reason === "checkmate") {
                    const iWon = message.winner === (playerColorRef.current === "w" ? "white" : "black");
                    result  = iWon ? "win" : "loss";
                    display = iWon ? "Checkmate — You win! 🏆" : "Checkmate — Opponent wins!";

                } else if (reason === "resignation") {
                    const iResigned = message.player === sessionStorage.getItem("playerId");
                    result  = iResigned ? "loss" : "win";
                    display = iResigned ? "You resigned." : "Opponent resigned — You win! 🏆";

                } else if (reason === "stalemate") {
                    display = "Stalemate — Draw!";

                } else if (reason === "insufficient_material") {
                    display = "Draw — Insufficient material!";

                } else if (reason === "repetition") {
                    display = "Draw — Fivefold repetition!";

                } else if (reason === "seventy_five_moves") {
                    display = "Draw — 75-move rule!";

                } else if (reason === "draw_agreed") {
                    display = "Draw agreed!";
                }

                setGameOverInfo({ message: display, result });
                setGameStatus("ended");
                setDrawOffered(false);
                setDrawOfferedBy(null);

                saveGameResult({
                    result,
                    reason,
                    moves: chess.history().length,
                });
                break;
            }

            case "ping": {
                wsRef.current?.send(JSON.stringify({ type: "pong" }));
                break;
            }

            default:
                break;
        }
    }, [saveGameResult]);

    // ------------------------------------------------------------------
    // WebSocket connection
    // ------------------------------------------------------------------
    const connectWebSocket = useCallback((pid) => {
        if (isConnecting.current || !pid) return;
        isConnecting.current = true;

        try {
            const name       = sessionStorage.getItem("playerName") || "";
            const wsUrl      = `${WS_URL}/ws/${gameId}?player_id=${pid}&player_name=${encodeURIComponent(name)}`;
            console.log("Connecting to WebSocket:", wsUrl);

            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("✅ WebSocket connected");
                setConnectionStatus("connected");
                setGameStatus("waiting");
                isConnecting.current   = false;
                reconnectAttempts.current = 0;
            };

            socket.onmessage = (e) => {
                try {
                    handleWebSocketMessage(JSON.parse(e.data));
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            };

            socket.onclose = (event) => {
                console.log("WebSocket closed:", event.code);
                setConnectionStatus("disconnected");
                isConnecting.current = false;

                if (
                    event.code !== 1000 &&
                    mountedRef.current &&
                    reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS
                ) {
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
    }, [gameId, handleWebSocketMessage]);

    useEffect(() => {
        mountedRef.current = true;

        if (!storedPlayerId) {
            console.error("No player ID in sessionStorage");
            return;
        }

        if (!connectionEstablished.current) {
            connectionEstablished.current = true;
            connectWebSocket(storedPlayerId);
        }

        return () => {
            mountedRef.current = false;
            connectionEstablished.current = false;
            wsRef.current?.close(1000, "Component unmounting");
        };
    }, [connectWebSocket, storedPlayerId]);

    // ------------------------------------------------------------------
    // Legal moves for Chessground
    // ------------------------------------------------------------------
    const getLegalMoves = useCallback(() => {
        if (gameStatus !== "playing") return new Map();

        const dests = new Map();
        chessRef.current.moves({ verbose: true }).forEach(move => {
            if (!dests.has(move.from)) dests.set(move.from, []);
            dests.get(move.from).push(move.to);
        });
        return dests;
    }, [gameStatus]);

    // ------------------------------------------------------------------
    // Player move
    // ------------------------------------------------------------------
    const onMove = useCallback((orig, dest) => {
        if (gameStatus !== "playing") {
            alert("Waiting for opponent...");
            return false;
        }
        if (connectionStatus !== "connected") {
            alert("Not connected to server");
            return false;
        }

        const chess = chessRef.current;
        const currentColor = playerColorRef.current;
        if (chess.turn() !== currentColor) {
            alert("Not your turn!");
            return false;
        }

        try {
            const move = chess.move({ from: orig, to: dest, promotion: "q" });
            if (!move) return false;

            setFen(chess.fen());

            wsRef.current?.send(JSON.stringify({
                type:      "move",
                from:      orig,
                to:        dest,
                promotion: "q",
                timestamp: Date.now(),
            }));
            return true;
        } catch (error) {
            console.error("Move error:", error);
            return false;
        }
    }, [gameStatus, connectionStatus]);

    // ------------------------------------------------------------------
    // Controls
    // ------------------------------------------------------------------
    const handleReset = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "reset" }));
    }, []);

    const handleResign = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "resign" }));
    }, []);

    const handleOfferDraw = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "draw_offer" }));
        setDrawOffered(true);
    }, []);

    const handleDrawResponse = useCallback((accept) => {
        wsRef.current?.send(JSON.stringify({
            type:     "draw_response",
            response: accept ? "accept" : "decline",
        }));
        setDrawOffered(false);
        setDrawOfferedBy(null);
    }, []);

    // ------------------------------------------------------------------
    // Render helpers
    // ------------------------------------------------------------------
    const getStatusText = () => {
        switch (gameStatus) {
            case "connecting": return "Connecting...";
            case "waiting":    return "Waiting for opponent...";
            case "playing":    return `Playing as ${playerColor === "w" ? "White" : "Black"}`;
            case "ended":      return "Game over";
            default:           return gameStatus;
        }
    };

    const boardSize = Math.min(500, window.innerWidth - 40);

    // ------------------------------------------------------------------
    // Early returns
    // ------------------------------------------------------------------
    if (!storedPlayerId) {
        return <div className="loading">No player information found. Please join a game first.</div>;
    }

    if (connectionStatus === "disconnected" && gameStatus !== "ended") {
        return <div className="loading">Connecting to game server...</div>;
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div className="game-container">
            <div className="game-info">
                <p><strong>Status:</strong> {getStatusText()}</p>
                {opponentName && <p><strong>Opponent:</strong> {opponentName}</p>}
                <p><strong>Turn:</strong> {chessRef.current.turn() === "w" ? "White" : "Black"}</p>
            </div>

            <div className="chessboard-wrapper">
                <Chessground
                    width={boardSize}
                    height={boardSize}
                    fen={fen}
                    orientation={playerColor === "b" ? "black" : "white"}
                    onMove={onMove}
                    movable={{
                        free:  false,
                        color: gameStatus === "playing" && chessRef.current.turn() === playerColor
                            ? (playerColor === "w" ? "white" : "black")
                            : undefined,
                        dests: getLegalMoves(),
                    }}
                    turnColor={chessRef.current.turn() === "w" ? "white" : "black"}
                />
            </div>

            {gameStatus === "playing" && !drawOffered && (
                <div className="game-controls">
                    <button
                        className="control-btn draw-btn"
                        onClick={handleOfferDraw}
                        disabled={connectionStatus !== "connected"}
                    >
                        Offer Draw
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

            {drawOffered && drawOfferedBy && drawOfferedBy !== storedPlayerId && (
                <div className="draw-prompt">
                    <p>Opponent offers a draw</p>
                    <button className="draw-response-btn accept" onClick={() => handleDrawResponse(true)}>
                        Accept
                    </button>
                    <button className="draw-response-btn decline" onClick={() => handleDrawResponse(false)}>
                        Decline
                    </button>
                </div>
            )}

            {gameStatus === "ended" && (
                <div className="game-over-container">
                    <div className="game-over-message">
                        <p>{gameOverInfo?.message || "Game Over"}</p>
                    </div>
                    <div className="game-over-buttons">
                        <button className="home-btn" onClick={() => navigate("/")}>
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
