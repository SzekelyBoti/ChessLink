import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/config";
import "./Home.css";

const generateDeviceId = () =>
    "player_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

function Home() {
    const [name,        setName]        = useState("");
    const [loading,     setLoading]     = useState(false);
    const [createdGame, setCreatedGame] = useState(null);
    const [error,       setError]       = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const savedName = sessionStorage.getItem("playerName");
        if (savedName) setName(savedName);
    }, []);

    // ------------------------------------------------------------------
    // Create game
    // ------------------------------------------------------------------
    const createGame = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await API.get("/create-game");
            setCreatedGame(res.data.game_id);
        } catch (err) {
            console.error(err);
            setError("Failed to create game. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    // ------------------------------------------------------------------
    // Join as creator
    // ------------------------------------------------------------------
    const joinAsCreator = useCallback(async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Please enter your name to join.");
            return;
        }

        setLoading(true);
        setError("");

        const deviceId = generateDeviceId();

        try {
            const res = await API.post("/join-game", {
                game_id:     createdGame,
                player_name: trimmed,
            });

            if (res.data.error) {
                setError(res.data.error);
                return;
            }

            sessionStorage.setItem("playerId",   deviceId);
            sessionStorage.setItem("playerName", trimmed);

            navigate(`/game/${createdGame}`);
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail;
            setError(detail || "Failed to join game. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [name, createdGame, navigate]);

    // ------------------------------------------------------------------
    // Copy invite link
    // ------------------------------------------------------------------
    const copyLink = useCallback(() => {
        const link = `${window.location.origin}/join/${createdGame}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).catch(() => {
                prompt("Copy this invite link:", link);
            });
        } else {
            prompt("Copy this invite link:", link);
        }
    }, [createdGame]);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div className="home-container">
            <h1 className="home-title">♜ ChessLink</h1>

            {!createdGame ? (
                <div className="initial-section">
                    {error && <div className="error-message">{error}</div>}

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
                        disabled={loading}
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

                        {error && <div className="error-message">{error}</div>}

                        <input
                            type="text"
                            className={`name-input ${error ? "error" : ""}`}
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && !loading && joinAsCreator()}
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
                            setError("");
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