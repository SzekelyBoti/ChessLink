import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/config";
import "./JoinGame.css";

const generateDeviceId = () =>
    "player_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

function JoinGame() {
    const { gameId } = useParams();
    const [name,    setName]    = useState("");
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const navigate = useNavigate();

    const joinGame = useCallback(async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Please enter your name");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await API.post("/join-game", {
                game_id:     gameId,
                player_name: trimmed,
            });

            if (res.data.error) {
                setError(res.data.error);
                return;
            }
            
            const deviceId = generateDeviceId();
            sessionStorage.setItem("playerId",   deviceId);
            sessionStorage.setItem("playerName", trimmed);
            sessionStorage.setItem("gameId",     gameId);

            console.log("Player joined:", { playerId: deviceId, playerName: trimmed, gameId });

            navigate(`/game/${gameId}`);
        } catch (err) {
            console.error("Join game error:", err);

            if (err.response) {
                setError(err.response.data?.detail || `Server error: ${err.response.status}`);
            } else if (err.request) {
                setError("Cannot connect to server. Please check if the backend is running.");
            } else {
                setError("Failed to join game. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }, [name, gameId, navigate]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter" && !loading) joinGame();
    }, [joinGame, loading]);

    return (
        <div className="join-game-container">
            <h2 className="join-game-title">Join Game</h2>

            <p className="game-id-display">
                Game ID: <strong>{gameId}</strong>
            </p>

            {error && (
                <div className="error-message">{error}</div>
            )}

            <div className="join-form">
                <input
                    className={`name-input ${error ? "error" : ""}`}
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    autoFocus
                />

                <button
                    className={`join-button ${loading ? "loading" : ""}`}
                    onClick={joinGame}
                    disabled={loading || !name.trim()}
                >
                    {loading ? "Joining..." : "Join Game"}
                </button>
            </div>

            {loading && (
                <div className="loading-spinner">
                    <div className="spinner" />
                </div>
            )}
        </div>
    );
}

export default JoinGame;