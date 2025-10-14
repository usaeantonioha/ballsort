document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const gameBoard = document.getElementById('game-board');
    const levelIndicator = document.getElementById('level-indicator');
    const undoBtn = document.getElementById('undo-btn');
    const restartBtn = document.getElementById('restart-btn');
    const hintBtn = document.getElementById('hint-btn');
    const addTubeBtn = document.getElementById('add-tube-btn');
    const winModal = document.getElementById('win-modal');
    const nextLevelBtn = document.getElementById('next-level-btn');

    // --- ESTADO DEL JUEGO ---
    const TUBE_CAPACITY = 4;
    let levels = [
        [[1, 2, 1, 2], [1, 2, 1, 2], [], []],
        [[3, 1, 2, 1], [3, 2, 3, 2], [3, 1, 2, 1], [], []],
        [[4, 5, 6, 4], [5, 6, 4, 5], [6, 4, 5, 6], [], []],
        // Agrega más niveles aquí
    ];
    
    let currentLevel = 0;
    let gameState = [];
    let selectedTube = { index: null, element: null };
    let moveHistory = [];
    let extraTubeAdded = false;

    // --- FUNCIONES PRINCIPALES ---

    function initLevel(levelIndex) {
        // Clonación profunda para no modificar el array original de niveles
        gameState = JSON.parse(JSON.stringify(levels[levelIndex]));
        moveHistory = [];
        extraTubeAdded = false;
        addTubeBtn.disabled = false;
        selectedTube = { index: null, element: null };
        levelIndicator.textContent = levelIndex + 1;
        renderBoard();
    }

    function renderBoard() {
        gameBoard.innerHTML = '';
        gameState.forEach((tubeContent, index) => {
            const tubeDiv = document.createElement('div');
            tubeDiv.classList.add('tube');
            tubeDiv.dataset.id = index;
            
            tubeContent.forEach(color => {
                const ballDiv = document.createElement('div');
                ballDiv.classList.add('ball');
                ballDiv.dataset.color = color;
                tubeDiv.appendChild(ballDiv);
            });
            
            tubeDiv.addEventListener('click', () => handleTubeClick(tubeDiv, index));
            gameBoard.appendChild(tubeDiv);
        });
    }

    function handleTubeClick(tubeElement, tubeIndex) {
        // Limpiar pistas visuales al interactuar
        document.querySelectorAll('.tube.hint').forEach(t => t.classList.remove('hint'));

        if (selectedTube.index === null) {
            // 1. SELECCIONAR UN TUBO DE ORIGEN
            if (gameState[tubeIndex].length > 0) {
                selectTube(tubeElement, tubeIndex);
            }
        } else {
            // 2. SELECCIONAR UN TUBO DE DESTINO Y MOVER
            if (isValidMove(selectedTube.index, tubeIndex)) {
                // Guardar el estado actual ANTES de mover
                moveHistory.push(JSON.parse(JSON.stringify(gameState)));

                const ballToMove = gameState[selectedTube.index].pop();
                gameState[tubeIndex].push(ballToMove);
                
                deselectTube();
                renderBoard();
                checkWinCondition();
            } else {
                deselectTube();
                // Opcional: Añadir un efecto de "movimiento inválido"
            }
        }
    }

    // --- LÓGICA DE AYUDAS ---
    
    undoBtn.addEventListener('click', () => {
        if (moveHistory.length > 0) {
            gameState = moveHistory.pop();
            renderBoard();
        }
    });
    
    addTubeBtn.addEventListener('click', () => {
        if (!extraTubeAdded) {
            gameState.push([]);
            extraTubeAdded = true;
            addTubeBtn.disabled = true;
            renderBoard();
        }
    });

    hintBtn.addEventListener('click', findAndShowHint);

    function findAndShowHint() {
        // Itera sobre todos los posibles movimientos
        for (let from = 0; from < gameState.length; from++) {
            if (gameState[from].length === 0) continue; // No se puede mover de un tubo vacío

            for (let to = 0; to < gameState.length; to++) {
                if (from === to) continue; // No mover al mismo tubo

                if (isValidMove(from, to)) {
                    // Encontramos una pista válida. Resaltar tubos.
                    document.querySelector(`.tube[data-id='${from}']`).classList.add('hint');
                    document.querySelector(`.tube[data-id='${to}']`).classList.add('hint');
                    return; // Salir después de encontrar la primera pista
                }
            }
        }
        alert("¡No hay más movimientos posibles!"); // Opcional
    }

    // --- FUNCIONES AUXILIARES ---

    function selectTube(tubeElement, tubeIndex) {
        selectedTube = { index: tubeIndex, element: tubeElement };
        tubeElement.classList.add('selected');
        const topBall = tubeElement.querySelector('.ball:last-child');
        if(topBall) topBall.classList.add('selected-ball');
    }

    function deselectTube() {
        if (selectedTube.element) {
            selectedTube.element.classList.remove('selected');
            const topBall = selectedTube.element.querySelector('.ball:last-child');
            if(topBall) topBall.classList.remove('selected-ball');
        }
        selectedTube = { index: null, element: null };
    }

    function isValidMove(fromIndex, toIndex) {
        const fromTube = gameState[fromIndex];
        const toTube = gameState[toIndex];
        if (fromTube.length === 0) return false;
        if (toTube.length >= TUBE_CAPACITY) return false;
        
        const ballToMoveColor = fromTube[fromTube.length - 1];
        const topBallInToTubeColor = toTube.length > 0 ? toTube[toTube.length - 1] : null;

        return topBallInToTubeColor === null || topBallInToTubeColor === ballToMoveColor;
    }
    
    function checkWinCondition() {
        const isWon = gameState.every(tube =>
            tube.length === 0 ||
            (tube.length === TUBE_CAPACITY && new Set(tube).size === 1)
        );

        if (isWon) {
            setTimeout(() => winModal.classList.remove('hidden'), 500);
        }
    }

    // --- EVENT LISTENERS DE LA INTERFAZ ---
    restartBtn.addEventListener('click', () => initLevel(currentLevel));
    
    nextLevelBtn.addEventListener('click', () => {
        currentLevel = (currentLevel + 1) % levels.length; // Va al siguiente o vuelve al primero
        winModal.classList.add('hidden');
        initLevel(currentLevel);
    });

    // --- INICIAR JUEGO ---
    initLevel(currentLevel);
});