import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/config";
import "./JoinGame.css";

function JoinGame() {
    const { gameId } = useParams();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const generateDeviceId = () => {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    };

    async function joinGame() {
        if (!name.trim()) {
            setError("Please enter your name");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const deviceId = generateDeviceId();

            const res = await API.post("/join-game", {
                game_id: gameId,
                player_name: name.trim()
            });

            if (res.data.error) {
                setError(res.data.error);
                setLoading(false);
                return;
            }

            sessionStorage.setItem("playerId", deviceId);
            sessionStorage.setItem("playerName", name.trim());
            sessionStorage.setItem("gameId", gameId);

            console.log("Player joined:", {
                playerId: deviceId,
                playerName: name.trim(),
                gameId: gameId
            });

            navigate(`/game/${gameId}`);
        } catch (err) {
            console.error("Join game error:", err);

            if (err.response) {
                setError(err.response.data?.detail || `Server error: ${err.response.status}`);
            } else if (err.request) {
                setError("Cannot connect to server. Please check if backend is running.");
            } else {
                setError("Failed to join game. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="join-game-container">
            <h2 className="join-game-title">Join Game</h2>

            <p className="game-id-display">
                Game ID: <strong>{gameId}</strong>
            </p>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="join-form">
                <input
                    className={`name-input ${error ? 'error' : ''}`}
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                    }}
                    disabled={loading}
                />

                <button
                    className={`join-button ${loading ? 'loading' : ''}`}
                    onClick={joinGame}
                    disabled={loading || !name.trim()}
                >
                    {loading ? "Joining..." : "Join Game"}
                </button>
            </div>

            {loading && (
                <div className="loading-spinner">
                    <div className="spinner"></div>
                </div>
            )}
        </div>
    );
}

export default JoinGame;