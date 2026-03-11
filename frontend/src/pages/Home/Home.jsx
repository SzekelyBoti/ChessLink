import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/config";
import "./Home.css";

function Home() {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [createdGame, setCreatedGame] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const savedName = sessionStorage.getItem("playerName");
        if (savedName) {
            setName(savedName);
        }
    }, []);

    async function createGame() {
        setLoading(true);
        try {
            const res = await API.get("/create-game");
            setCreatedGame(res.data.game_id);
        } catch (err) {
            console.error(err);
            alert("Failed to create game");
        } finally {
            setLoading(false);
        }
    }

    function copyLink() {
        const link = `${window.location.origin}/join/${createdGame}`;
        navigator.clipboard.writeText(link);
        alert("Invite link copied!");
    }

    async function joinAsCreator() {
        if (!name.trim()) {
            alert("Enter your name to join");
            return;
        }

        setLoading(true);
        try {
            const deviceId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

            sessionStorage.setItem("playerId", deviceId);
            sessionStorage.setItem("playerName", name.trim());

            const res = await API.post("/join-game", {
                game_id: createdGame,
                player_name: name.trim()
            });

            if (res.data.error) {
                sessionStorage.removeItem("playerId");
                sessionStorage.removeItem("playerName");
                alert(res.data.error);
                return;
            }

            navigate(`/game/${createdGame}`);
        } catch (err) {
            console.error(err);
            sessionStorage.removeItem("playerId");
            sessionStorage.removeItem("playerName");
            alert("Failed to join game");
        } finally {
            setLoading(false);
        }
    }
    

    return (
        <div className="home-container">
            <h1 className="home-title">♜ ChessLink</h1>

            {!createdGame ? (
                <div className="initial-section">
                    <button
                        className="create-btn"
                        onClick={createGame}
                        disabled={loading}
                    >
                        {loading ? "Creating..." : "Create New Game"}
                    </button>

                    <button
                        className="matches-btn"
                        onClick={() => navigate("/matches")}
                    >
                        View Recent Matches
                    </button>

                    {loading && <div className="spinner" />}
                </div>
            ) : (
                <div className="game-created-section">
                    <div className="success-message">
                        <h2>✓ Game Created!</h2>
                    </div>

                    <div className="game-details">
                        <div className="detail-row">
                            <span className="detail-label">Game ID:</span>
                            <span className="detail-value">{createdGame}</span>
                        </div>

                        <div className="detail-row">
                            <span className="detail-label">Invite Link:</span>
                            <code className="invite-link">
                                {window.location.origin}/join/{createdGame}
                            </code>
                        </div>
                    </div>

                    <button
                        className="copy-btn"
                        onClick={copyLink}
                        disabled={loading}
                    >
                        📋 Copy Invite Link
                    </button>

                    <div className="join-creator-section">
                        <h3>Join as Creator</h3>
                        <input
                            type="text"
                            className="name-input"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={loading}
                        />
                        <button
                            className="join-creator-btn"
                            onClick={joinAsCreator}
                            disabled={loading || !name.trim()}
                        >
                            {loading ? "Joining..." : "Start Game"}
                        </button>
                    </div>

                    <button
                        className="back-btn"
                        onClick={() => {
                            setCreatedGame(null);
                            setName("");
                        }}
                        disabled={loading}
                    >
                        ← Create Different Game
                    </button>

                    {loading && <div className="spinner" />}
                </div>
            )}
        </div>
    );
}

export default Home;