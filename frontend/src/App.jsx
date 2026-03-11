import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Home from "./pages/Home/Home";
import JoinGame from "./pages/JoinGame/JoinGame";
import Game from "./pages/Game/Game";
import Matches from "./pages/Matches/Matches.jsx";

function App() {
    return (
        <DndProvider backend={HTML5Backend}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/join/:gameId" element={<JoinGame />} />
                    <Route path="/game/:gameId" element={<Game />} />
                    <Route path="/matches" element={<Matches />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </DndProvider>
    );
}

export default App;
