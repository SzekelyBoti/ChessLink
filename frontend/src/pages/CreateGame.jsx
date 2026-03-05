import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/config";

function CreateGame() {
    const [gameId, setGameId] = useState(null);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Step 1: Create game
    async function createGame() {
        setLoading(true);
        try {
            // Use API instance instead of axios directly
            const res = await API.get("/create-game");
            setGameId(res.data.game_id);
        } catch (err) {
            console.error(err);
            alert("Failed to create game");
        } finally {
            setLoading(false);
        }
    }

    // Step 2: Copy invite link
    function copyLink() {
        const link = `${window.location.origin}/join/${gameId}`;
        navigator.clipboard.writeText(link);
        alert("Invite link copied!");
    }

    // Step 3: Join game with name
    async function joinGame() {
        if (!name.trim()) {
            alert("Enter your name to join");
            return;
        }

        setLoading(true);
        try {
            // Use API instance instead of axios directly
            const res = await API.post("/join-game", {
                game_id: gameId,
                player_name: name.trim()
            });

            if (res.data.error) {
                alert(res.data.error);
                return;
            }

            sessionStorage.setItem("playerId", name.trim());
            navigate(`/game/${gameId}`);
        } catch (err) {
            console.error(err);
            alert("Failed to join game");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: "20px", maxWidth: "500px", margin: "0 auto" }}>
            <h2>Create Game</h2>

            {!gameId && (
                <button
                    onClick={createGame}
                    disabled={loading}
                >
                    {loading ? "Creating..." : "Create Game"}
                </button>
            )}

            {gameId && (
                <div>
                    <p><strong>Game created!</strong></p>
                    <p>Game ID: {gameId}</p>
                    <p>Invite Link: <br />
                        <code>{window.location.origin}/join/{gameId}</code>
                    </p>

                    <button onClick={copyLink}>
                        Copy Invite Link
                    </button>

                    <hr />

                    <h3>Join as Creator</h3>
                    <input
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        onClick={joinGame}
                        disabled={loading || !name.trim()}
                    >
                        {loading ? "Joining..." : "Join Game"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default CreateGame;