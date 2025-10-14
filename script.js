document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const levelIndicator = document.getElementById('level-indicator');
    const restartBtn = document.getElementById('restart-btn');
    const undoBtn = document.getElementById('undo-btn');
    const winModal = document.getElementById('win-modal');
    const nextLevelBtn = document.getElementById('next-level-btn');
    
    const FLASK_CAPACITY = 4;

    const levels = [
        // Nivel 1: Tutorial
        { layout: [[1, 2, 1, 2], [1, 2, 1, 2], [], []] },
        // Nivel 2: Más colores
        { layout: [[3, 1, 2, 1], [3, 2, 3, 2], [3, 1, 2, 1], [], []] },
        // Nivel 3: Sin frasco vacío
        { layout: [[4, 1, 2, 3], [4, 1, 2, 3], [4, 1, 2, 3], [4, 1, 2, 3]] },
         // Nivel 4
        { layout: [[5, 6, 1, 2], [5, 1, 6, 2], [5, 1, 6, 2], [5, 1, 6, 2], [], []] },
         // Nivel 5
        { layout: [[1, 2, 3, 4], [1, 5, 6, 4], [2, 5, 6, 3], [1, 5, 6, 4], [2, 5, 6, 3], [], []] }
        // ... Agrega más niveles aquí
    ];

    let currentLevel = 0;
    let gameState = [];
    let selectedFlask = null;
    let moveHistory = [];

    function initLevel(levelIndex) {
        if (levelIndex >= levels.length) {
            alert("¡Has completado todos los niveles!");
            currentLevel = 0; // Reinicia o muestra pantalla final
        }
        
        // Clonación profunda para no modificar la estructura original del nivel
        gameState = JSON.parse(JSON.stringify(levels[levelIndex].layout));
        levelIndicator.textContent = levelIndex + 1;
        selectedFlask = null;
        moveHistory = [];
        renderGame();
    }

    function renderGame() {
        gameContainer.innerHTML = '';
        gameState.forEach((flaskContent, index) => {
            const flaskDiv = document.createElement('div');
            flaskDiv.classList.add('flask');
            flaskDiv.dataset.id = index;
            
            flaskContent.forEach(color => {
                const ballDiv = document.createElement('div');
                ballDiv.classList.add('ball');
                ballDiv.dataset.color = color;
                flaskDiv.appendChild(ballDiv);
            });

            if (selectedFlask !== null && selectedFlask.index === index) {
                const topBall = flaskDiv.querySelector('.ball:last-child');
                if (topBall) topBall.classList.add('selected');
            }
            
            if (isFlaskComplete(flaskContent)) {
                flaskDiv.classList.add('completed');
            }

            flaskDiv.addEventListener('click', () => handleFlaskClick(index));
            gameContainer.appendChild(flaskDiv);
        });
    }

    function handleFlaskClick(flaskIndex) {
        const clickedFlaskData = gameState[flaskIndex];

        if (selectedFlask === null) {
            // Si no hay nada seleccionado, y el frasco no está vacío, selecciona uno.
            if (clickedFlaskData.length > 0) {
                const topColor = clickedFlaskData[clickedFlaskData.length - 1];
                selectedFlask = { index: flaskIndex, color: topColor };
            }
        } else {
            // Si ya hay uno seleccionado, intenta moverlo.
            const originFlaskData = gameState[selectedFlask.index];
            
            // Comprueba si el movimiento es válido
            const isValidMove = (
                clickedFlaskData.length < FLASK_CAPACITY && // Hay espacio
                (clickedFlaskData.length === 0 || clickedFlaskData[clickedFlaskData.length - 1] === selectedFlask.color) // Está vacío o el color coincide
            );

            if (flaskIndex !== selectedFlask.index && isValidMove) {
                // Mover la bola
                const ballToMove = originFlaskData.pop();
                clickedFlaskData.push(ballToMove);
                
                // Guardar movimiento
                moveHistory.push({ from: selectedFlask.index, to: flaskIndex });

                selectedFlask = null;
                checkWinCondition();
            } else {
                // Deseleccionar si el movimiento es inválido o se clickea el mismo frasco
                selectedFlask = null;
            }
        }
        renderGame();
    }
    
    function isFlaskComplete(flaskContent) {
        return flaskContent.length === FLASK_CAPACITY && new Set(flaskContent).size === 1;
    }

    function checkWinCondition() {
        const allFlasksDone = gameState.every(flask => 
            flask.length === 0 || flask.length === FLASK_CAPACITY && new Set(flask).size === 1
        );

        if (allFlasksDone) {
            setTimeout(() => {
                winModal.classList.remove('hidden');
            }, 500); // Pequeña espera para disfrutar la vista
        }
    }

    function undoLastMove() {
        if (moveHistory.length === 0) return;

        const lastMove = moveHistory.pop();
        const ballToMove = gameState[lastMove.to].pop();
        gameState[lastMove.from].push(ballToMove);
        
        selectedFlask = null;
        renderGame();
    }

    restartBtn.addEventListener('click', () => initLevel(currentLevel));
    undoBtn.addEventListener('click', undoLastMove);
    
    nextLevelBtn.addEventListener('click', () => {
        currentLevel++;
        winModal.classList.add('hidden');
        initLevel(currentLevel);
    });

    // Iniciar el juego
    initLevel(currentLevel);
});