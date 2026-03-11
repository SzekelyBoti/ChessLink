import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/config";
import "./Matches.css";

function Matches() {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all");
    const [playerName, setPlayerName] = useState("");
    const [searchPerformed, setSearchPerformed] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRecentMatches();
    }, []);

    const fetchRecentMatches = async () => {
        setLoading(true);
        setError(null);
        setFilter("recent");
        setSearchPerformed(false);

        try {
            const res = await API.get("/matches/recent?limit=50");
            setMatches(res.data.matches);
        } catch (err) {
            console.error("Failed to fetch matches:", err);
            setError("Failed to load matches. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const searchPlayerMatches = async () => {
        if (!playerName.trim()) {
            alert("Please enter a player name");
            return;
        }

        setLoading(true);
        setError(null);
        setFilter("player");
        setSearchPerformed(true);

        try {
            const res = await API.get(`/player/${encodeURIComponent(playerName.trim())}/matches?limit=50`);
            setMatches(res.data.matches);
        } catch (err) {
            console.error("Failed to fetch player matches:", err);
            setError(`No matches found for player "${playerName}"`);
            setMatches([]);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const getResultClass = (match, playerName) => {
        if (match.winner === "draw") return "draw";
        if (match.whiteName === playerName) {
            return match.winner === "white" ? "win" : "loss";
        }
        if (match.blackName === playerName) {
            return match.winner === "black" ? "win" : "loss";
        }
        return "";
    };

    const getResultText = (match) => {
        if (match.winner === "draw") return "Draw";
        return `${match.winner === 'white' ? match.whiteName : match.blackName} wins`;
    };

    const getReasonText = (reason) => {
        const reasons = {
            checkmate: "Checkmate",
            stalemate: "Stalemate",
            resignation: "Resignation",
            agreement: "Draw Agreed",
            insufficient_material: "Insufficient Material",
            repetition: "Threefold Repetition",
            timeout: "Time Out"
        };
        return reasons[reason] || reason;
    };

    if (loading && matches.length === 0) {
        return (
            <div className="matches-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading matches...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="matches-container">
            <div className="matches-header">
                <h1 className="matches-title">Match History</h1>
                <button className="back-btn" onClick={() => navigate("/")}>
                    ← Back to Home
                </button>
            </div>

            <div className="search-section">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Enter player name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchPlayerMatches()}
                    />
                    <button onClick={searchPlayerMatches} disabled={loading}>
                        Search Player
                    </button>
                </div>
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${filter === 'recent' ? 'active' : ''}`}
                        onClick={fetchRecentMatches}
                        disabled={loading}
                    >
                        Recent Matches
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {searchPerformed && !loading && matches.length === 0 && !error && (
                <div className="no-matches">
                    No matches found for "{playerName}"
                </div>
            )}

            <div className="matches-list">
                {matches.map((match) => (
                    <div key={match.gameId} className="match-card">
                        <div className="match-header">
                            <span className="match-date">{formatDate(match.timestamp)}</span>
                            <span className={`match-result ${match.winner}`}>
                                {getResultText(match)}
                            </span>
                        </div>

                        <div className="match-players">
                            <div className={`player white-player ${getResultClass(match, match.whiteName)}`}>
                                <span className="player-color">⚪</span>
                                <span className="player-name">{match.whiteName}</span>
                                {match.winner === "white" && <span className="winner-badge">🏆</span>}
                            </div>
                            <div className="vs">vs</div>
                            <div className={`player black-player ${getResultClass(match, match.blackName)}`}>
                                <span className="player-color">⚫</span>
                                <span className="player-name">{match.blackName}</span>
                                {match.winner === "black" && <span className="winner-badge">🏆</span>}
                            </div>
                        </div>

                        <div className="match-details">
                            <span className="match-reason">{getReasonText(match.reason)}</span>
                            <span className="match-moves">{match.moves} moves</span>
                        </div>

                        {match.moves_list && match.moves_list.length > 0 && (
                            <button
                                className="replay-btn"
                                onClick={() => navigate(`/replay/${match.gameId}`)}
                            >
                                Replay Game
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {matches.length === 0 && !loading && !error && !searchPerformed && (
                <div className="no-matches">
                    No matches found. Play some games to see them here!
                </div>
            )}
        </div>
    );
}

export default Matches;