const Message = require('../models/messageModel');

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find().populate('sender', ['username']);
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.sendMessage = async (req, res) => {
  const { sender, content } = req.body;
  try {
    const newMessage = new Message({ sender, content });
    await newMessage.save();
    res.json(newMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
