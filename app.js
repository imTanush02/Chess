require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const socketIO = require("socket.io");
const cookie = require("cookie");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const { Chess } = require("chess.js");

const authRoutes = require("./routes/auth");
const User = require("./models/User");
const { verifySocketToken, verifyToken } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Mongo connected"))
  .catch((e) => console.error(e));
const io = socketIO(server, {
  cors: { origin: true, credentials: true },
});


app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
require("./config/passport")(passport);

app.use("/auth", authRoutes);

app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("Login"));
app.get("/signup", (req, res) => res.render("SignUp"));
app.get("/home", verifyToken, (req, res) => {
  if (!req.user) {
    return res.redirect("/"); // Redirect to `/` if user is unauthorized
  }
  res.render("chess", { user: req.user }); 
});

const chess = new Chess();
let players = { white: null, black: null }; // will hold socketId
let userBySocket = {}; // socketId -> user info

io.use((socket, next) => {
  let token;

  // headers me cookie check
  if (socket.handshake.headers.cookie) {
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    token = cookies.token; // jo naam tu res.cookie me set kar raha hai
  }

  const decoded = verifySocketToken(token);
  if (!decoded) {
    socket.user = null;
    return next();
  }
  socket.user = decoded;
  next();
});

io.on("connection", (socket) => {
  console.log(socket.user);

  console.log("new connection", socket.id, "user:", socket.user && socket.user.email);

  // if authenticated assign to players if space available
  if (socket.user) {
    // try assign white then black if not taken
    if (!players.white) {
      players.white = socket.id;
      userBySocket[socket.id] = { role: "w", userId: socket.user.id, email: socket.user.email };
      socket.emit("playerRole", "w");
    } else if (!players.black) {
      players.black = socket.id;
      userBySocket[socket.id] = { role: "b", userId: socket.user.id, email: socket.user.email };
      socket.emit("playerRole", "b");
    } else {
      userBySocket[socket.id] = { role: "spectator" };
      socket.emit("spectatorRole");
    }
  } else {
    // unauthenticated spectator
    userBySocket[socket.id] = { role: "spectator" };
    socket.emit("spectatorRole");
  }

  // send initial board fen
  socket.emit("boardState", chess.fen());

  socket.on("disconnect", () => {
    console.log("disconnect", socket.id);
    const info = userBySocket[socket.id];
    if (info && info.role === "w") {
      players.white = null;
    } else if (info && info.role === "b") {
      players.black = null;
    }
    delete userBySocket[socket.id];
  });

  socket.on("move", (move) => {
    try {
      // check sender is allowed to move
      const info = userBySocket[socket.id];
      const turn = chess.turn(); // 'w' or 'b'
      if (!info || info.role === "spectator") {
        socket.emit("InvalidMove", "not-player");
        return;
      }
      if (info.role !== turn) {
        socket.emit("InvalidMove", "not-your-turn");
        return;
      }

      const result = chess.move(move);
      if (result) {
        io.emit("move", move);
        io.emit("boardState", chess.fen());
      } else {
        socket.emit("InvalidMove", "illegal");
      }
    } catch (err) {
      console.error(err);
      socket.emit("InvalidMove", "error");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on", PORT));
