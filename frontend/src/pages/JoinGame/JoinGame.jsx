import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/config";
import "./JoinGame.css";

function JoinGame() {
    const { gameId } = useParams();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function joinGame() {
        if (!name.trim()) {
            alert("Please enter your name");
            return;
        }

        setLoading(true);

        try {
            const res = await API.post("/join-game", {
                game_id: gameId,
                player_name: name.trim()
            });

            if (res.data.error) {
                alert(res.data.error);
                return;
            }

            sessionStorage.setItem("playerId", name.trim());
            sessionStorage.setItem("gameId", gameId);

            navigate(`/game/${gameId}`);
        } catch (err) {
            console.error("Join game error:", err);

            if (err.response) {
                alert(`Server error: ${err.response.data?.error || err.response.status}`);
            } else if (err.request) {
                alert("Cannot connect to server. Make sure the backend is running.");
            } else {
                alert("Failed to join game. Please try again.");
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

            <div className="join-form">
                <input
                    className="name-input"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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