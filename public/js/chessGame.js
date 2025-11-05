const token = localStorage.getItem("token"); // ya cookie se read kar
const socket = io();

const chess = new Chess();

const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let selectedSquare = null;
let validMoves = [];

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";
  board.forEach((row, rowIndex) => {
    row.forEach((square, squareIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + squareIndex) % 2 === 0 ? "Light" : "Dark"
      );
      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = squareIndex;
      
      // Highlight selected square
      if (selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === squareIndex) {
        squareElement.classList.add("selected");
      }
      
      // Highlight valid moves
      const squareNotation = `${String.fromCharCode(97 + squareIndex)}${8 - rowIndex}`;
      if (validMoves.includes(squareNotation)) {
        squareElement.classList.add("valid-move");
        if (square) {
          squareElement.classList.add("has-piece");
        }
      }

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = false; // Disable drag and drop

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("click", () => {
        handleSquareClick(rowIndex, squareIndex, square);
      });

      boardElement.appendChild(squareElement);
    });
  });

  if(playerRole === "b"){
    boardElement.classList.add("flipped")
  }
  else{
    boardElement.classList.remove("flipped")
  }
  
  // Check for game over
  checkGameOver();
};
const handleMove = (source, target) => {
  const move = {
    from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
    to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
    promotion: "q",
  };
  socket.emit("move", move);
};

const getPieceUnicode = (piece) => {
  const unicodePieces = {
    P: "♙",
    R: "♖",
    N: "♘",
    B: "♗",
    K: "♔",
    Q: "♕",
    p: "♙",
    r: "♜",
    n: "♞",
    b: "♝",
    k: "♚",
    q: "♛",
  };
  return unicodePieces[piece.type] || "";
};

socket.on("playerRole", (role) => {
  playerRole = role;
  renderBoard();
});
socket.on("spectatorRole", () => {
  playerRole = null;
  renderBoard();
});
socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});
socket.on("move", (fen) => {
  chess.move(fen);
  renderBoard();
});

// Handle game over from server
socket.on("gameOver", (data) => {
  let title = "Game Over";
  let message = "";
  let icon = "🏁";
  
  if (data.reason === "checkmate") {
    title = "Checkmate!";
    message = `${data.winner} wins!`;
    icon = "🏆";
  } else if (data.reason === "stalemate") {
    title = "Stalemate!";
    message = "The game is a draw.";
    icon = "🤝";
  } else if (data.reason === "threefold_repetition") {
    title = "Draw!";
    message = "Threefold repetition.";
    icon = "🔄";
  } else if (data.reason === "insufficient_material") {
    title = "Draw!";
    message = "Insufficient material.";
    icon = "⚖️";
  } else if (data.reason === "draw") {
    title = "Draw!";
    message = "The game is a draw.";
    icon = "🤝";
  }
  
  showGameOverModal(title, message, icon);
});

// Handle players update
socket.on("playersUpdate", (players) => {
  const topPlayerElement = document.getElementById("topPlayerName");
  const bottomPlayerElement = document.getElementById("bottomPlayerName");
  const waitingNotification = document.getElementById("waitingNotification");
  const spectatorCounter = document.getElementById("spectatorCounter");
  const spectatorCount = document.getElementById("spectatorCount");
  
  // Determine which player is which based on your role
  let yourName = "You";
  let opponentName = "Waiting...";
  
  if (playerRole === "w") {
    // You are white (bottom), opponent is black (top)
    yourName = players.white ? players.white.email : "You";
    opponentName = players.black ? players.black.email : "Waiting...";
  } else if (playerRole === "b") {
    // You are black (bottom), opponent is white (top)
    yourName = players.black ? players.black.email : "You";
    opponentName = players.white ? players.white.email : "Waiting...";
  } else {
    // Spectator mode
    yourName = "Spectator";
    opponentName = players.white ? players.white.email : "Waiting...";
  }
  
  // Update player names
  bottomPlayerElement.querySelector("p").innerText = yourName;
  topPlayerElement.querySelector("p").innerText = opponentName;
  
  // Show/hide waiting notification
  const bothPlayersPresent = players.white && players.black;
  if (bothPlayersPresent) {
    waitingNotification.style.display = "none";
  } else {
    waitingNotification.style.display = "block";
  }
  
  // Update spectator counter
  if (players.spectators && players.spectators > 0) {
    spectatorCount.innerText = players.spectators;
    spectatorCounter.style.display = "flex";
  } else {
    spectatorCounter.style.display = "none";
  }
});

// Handle square click for piece selection and movement
const handleSquareClick = (row, col, square) => {
  // If a square is already selected
  if (selectedSquare) {
    const targetSquare = { row, col };
    const targetNotation = `${String.fromCharCode(97 + col)}${8 - row}`;
    
    // If clicking on a valid move, make the move
    if (validMoves.includes(targetNotation)) {
      handleMove(selectedSquare, targetSquare);
      selectedSquare = null;
      validMoves = [];
      renderBoard();
    } 
    // If clicking on another piece of the same color, select it
    else if (square && square.color === playerRole) {
      selectedSquare = { row, col };
      showValidMoves(row, col);
      renderBoard();
    }
    // Otherwise, deselect
    else {
      selectedSquare = null;
      validMoves = [];
      renderBoard();
    }
  } 
  // If no square is selected and clicking on your own piece
  else if (square && square.color === playerRole) {
    selectedSquare = { row, col };
    showValidMoves(row, col);
    renderBoard();
  }
};

const showValidMoves = (row, col) => {
  const squareNotation = `${String.fromCharCode(97 + col)}${8 - row}`;
  const moves = chess.moves({ square: squareNotation, verbose: true });
  validMoves = moves.map(move => move.to);
};

const checkGameOver = () => {
  if (chess.game_over()) {
    let title = "Game Over";
    let message = "";
    let icon = "🏁";
    
    if (chess.in_checkmate()) {
      const winner = chess.turn() === "w" ? "Black" : "White";
      title = "Checkmate!";
      message = `${winner} wins!`;
      icon = "🏆";
    } else if (chess.in_stalemate()) {
      title = "Stalemate!";
      message = "The game is a draw.";
      icon = "🤝";
    } else if (chess.in_threefold_repetition()) {
      title = "Draw!";
      message = "Threefold repetition.";
      icon = "🔄";
    } else if (chess.insufficient_material()) {
      title = "Draw!";
      message = "Insufficient material.";
      icon = "⚖️";
    } else if (chess.in_draw()) {
      title = "Draw!";
      message = "The game is a draw.";
      icon = "🤝";
    }
    
    showGameOverModal(title, message, icon);
  }
};

const showGameOverModal = (title, message, icon) => {
  const modal = document.getElementById("gameOverModal");
  const backdrop = document.getElementById("gameOverBackdrop");
  const titleElement = document.getElementById("gameOverTitle");
  const messageElement = document.getElementById("gameOverMessage");
  const iconElement = document.getElementById("gameOverIcon");
  
  titleElement.innerText = title;
  messageElement.innerText = message;
  iconElement.innerText = icon;
  
  modal.style.display = "block";
  backdrop.style.display = "block";
};

renderBoard();
