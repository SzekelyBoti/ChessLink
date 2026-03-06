import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/config";
import "./Home.css";

function Home() {
    const [gameId, setGameId] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [createdGame, setCreatedGame] = useState(null);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const navigate = useNavigate();
    
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
            const res = await API.post("/join-game", {
                game_id: createdGame,
                player_name: name.trim()
            });

            if (res.data.error) {
                alert(res.data.error);
                return;
            }

            sessionStorage.setItem("playerId", name.trim());
            navigate(`/game/${createdGame}`);
        } catch (err) {
            console.error(err);
            alert("Failed to join game");
        } finally {
            setLoading(false);
        }
    }
    
    async function joinExistingGame() {
        if (!gameId.trim()) {
            alert("Please enter a Game ID");
            return;
        }

        if (!name.trim()) {
            alert("Please enter your name");
            return;
        }

        setLoading(true);
        try {
            const res = await API.post("/join-game", {
                game_id: gameId.trim(),
                player_name: name.trim()
            });

            if (res.data.error) {
                alert(res.data.error);
                return;
            }

            sessionStorage.setItem("playerId", name.trim());
            navigate(`/game/${gameId.trim()}`);
        } catch (err) {
            console.error(err);
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

                    <div className="divider">or</div>

                    <button
                        className="show-join-btn"
                        onClick={() => setShowJoinForm(!showJoinForm)}
                    >
                        Join Existing Game
                    </button>

                    {showJoinForm && (
                        <div className="join-existing-section">
                            <h3>Join Existing Game</h3>
                            <input
                                type="text"
                                className="game-id-input"
                                placeholder="Enter Game ID"
                                value={gameId}
                                onChange={(e) => setGameId(e.target.value)}
                                disabled={loading}
                            />
                            <input
                                type="text"
                                className="name-input"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={loading}
                            />
                            <button
                                className="join-btn"
                                onClick={joinExistingGame}
                                disabled={loading || !gameId.trim() || !name.trim()}
                            >
                                {loading ? "Joining..." : "Join Game"}
                            </button>
                        </div>
                    )}
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
                    >
                        ← Create Different Game
                    </button>
                </div>
            )}
        </div>
    );
}

export default Home;