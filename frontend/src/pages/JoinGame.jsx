import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api/config";

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
        <div style={{
            padding: "40px 20px",
            maxWidth: "500px",
            margin: "0 auto",
            textAlign: "center"
        }}>
            <h2>Join Game</h2>
            <p style={{ marginBottom: "20px", color: "#666" }}>
                Game ID: <strong>{gameId}</strong>
            </p>

            <input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                style={{
                    padding: "10px",
                    width: "250px",
                    fontSize: "1rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    marginRight: "10px"
                }}
            />

            <button
                onClick={joinGame}
                disabled={loading || !name.trim()}
                style={{
                    padding: "10px 20px",
                    fontSize: "1rem",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1
                }}
            >
                {loading ? "Joining..." : "Join Game"}
            </button>
        </div>
    );
}

export default JoinGame;