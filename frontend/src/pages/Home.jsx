import { useNavigate } from "react-router-dom";
import { useState } from "react";

function Home() {
    const [gameId, setGameId] = useState("");
    const navigate = useNavigate();

    const handleJoinGame = () => {
        if (!gameId.trim()) {
            alert("Please enter a Game ID");
            return;
        }
        navigate(`/join/${gameId.trim()}`);
    };

    return (
        <div style={{
            padding: "40px 20px",
            maxWidth: "500px",
            margin: "0 auto",
            textAlign: "center"
        }}>
            <h1 style={{ fontSize: "3rem", marginBottom: "40px" }}>♜ ChessLink</h1>

            <button
                onClick={() => navigate("/create")}
                style={{
                    padding: "15px 40px",
                    fontSize: "1.2rem",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    marginBottom: "30px"
                }}
            >
                Create New Game
            </button>

            <div style={{
                padding: "20px",
                backgroundColor: "#f5f5f5",
                borderRadius: "8px"
            }}>
                <h3>Or join existing game:</h3>
                <input
                    placeholder="Enter Game ID"
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    style={{
                        padding: "10px",
                        fontSize: "1rem",
                        width: "200px",
                        marginRight: "10px",
                        borderRadius: "4px",
                        border: "1px solid #ccc"
                    }}
                />
                <button
                    onClick={handleJoinGame}
                    style={{
                        padding: "10px 20px",
                        fontSize: "1rem",
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                    }}
                >
                    Join Game
                </button>
            </div>
        </div>
    );
}

export default Home;