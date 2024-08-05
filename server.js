const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

 mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true ,}).then(()=>console.log('mongodb connected')).catch(err=>console.log(err));

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const MessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  file: String,
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.sendStatus(201);
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ username }, 'SECRET_KEY');
    res.json({ token });
  } else {
    res.sendStatus(401);
  }
});

app.post('/messages', async (req, res) => {
  const { token } = req.body;
  try {
    const payload = jwt.verify(token, 'SECRET_KEY');
    const messages = await Message.find({ $or: [{ sender: payload.username }, { receiver: payload.username }] });
    res.json(messages);
  } catch {
    res.sendStatus(401);
  }
});

app.get('/users', async (req, res) => {
  const users = await User.find({}, 'username');
  res.json(users);
});

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = jwt.verify(token, 'SECRET_KEY');
    socket.username = payload.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected: ' + socket.username);

  socket.on('private message', async ({ content, to, file }) => {
    const message = new Message({ sender: socket.username, receiver: to, content, file });
    await message.save();
    socket.to(to).emit('private message', { content, from: socket.username, file });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.username);
  });
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});
