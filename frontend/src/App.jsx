import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Home from "./pages/Home";
import CreateGame from "./pages/CreateGame";
import JoinGame from "./pages/JoinGame";
import Game from "./pages/Game";

function App() {
    return (
        <DndProvider backend={HTML5Backend}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/create" element={<CreateGame />} />
                    <Route path="/join/:gameId" element={<JoinGame />} />
                    <Route path="/game/:gameId" element={<Game />} />
                </Routes>
            </BrowserRouter>
        </DndProvider>
    );
}

export default App;
