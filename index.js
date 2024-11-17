require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const authenticateToken = require("./utilities");
const config = require("./config.json");
const User = require("./models/user.model");
const Note = require("./models/note.model");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "https://notes-frontend-mern.vercel.app",
  })
);

mongoose
  .connect(config.connectionString)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

const generateAccessToken = (user) => {
  return jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "36000m",
  });
};

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the API" });
});

app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({
      error: true,
      message: "Full Name, Email, and Password are required.",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: "User already exists.",
      });
    }

    const newUser = new User({ fullName, email, password });
    await newUser.save();

    const accessToken = generateAccessToken(newUser);

    return res.status(201).json({
      error: false,
      user: newUser,
      accessToken,
      message: "Registration successful.",
    });
  } catch (err) {
    console.error("Error creating user:", err);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: "Email and Password are required.",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({
        error: true,
        message: "User not found. Please register first.",
      });
    }

    if (existingUser.password !== password) {
      return res.status(401).json({
        error: true,
        message: "Invalid credentials.",
      });
    }

    const accessToken = generateAccessToken(existingUser);

    return res.status(200).json({
      error: false,
      user: existingUser,
      accessToken,
      message: "Login successful.",
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const userDetails = await User.findById(user._id).select("-password");

    if (!userDetails) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      error: false,
      user: userDetails,
      message: "User fetched successfully.",
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title || !content) {
    return res.status(400).json({
      error: true,
      message: "Title and content are required.",
    });
  }

  try {
    const newNote = new Note({
      title,
      content,
      tags: tags || [],
      userId: user._id,
    });

    const savedNote = await newNote.save();

    return res.status(201).json({
      error: false,
      message: "Note created successfully.",
      note: savedNote,
    });
  } catch (error) {
    console.error("Error creating note:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;
  const noteId = req.params.noteId;

  if (!title && !content && !tags) {
    return res.status(400).json({
      error: true,
      message: "No chnages provided.",
    });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found.",
      });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    const updatedNote = await note.save();

    return res.status(200).json({
      error: false,
      message: "Note updated successfully.",
      note: updatedNote,
    });
  } catch (error) {
    console.error("Error updating note:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.get("/get-all-notes", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const notes = await Note.find({ userId: user._id });

    if (notes.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No notes found.",
      });
    }

    return res.status(200).json({
      error: false,
      notes,
      message: "Notes fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const noteId = req.params.noteId;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found.",
      });
    }

    await Note.deleteOne({ _id: noteId });

    return res.status(200).json({
      error: false,
      message: "Note deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting note:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.get("/get-pinned-notes", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const pinnedNotes = await Note.find({ userId: user._id, isPinned: true });

    if (pinnedNotes.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No pinned notes found.",
      });
    }

    return res.status(200).json({
      error: false,
      notes: pinnedNotes,
      message: "Pinned notes fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching pinned notes:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.put("/update-pin-status/:noteId", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const noteId = req.params.noteId;
  const { isPinned } = req.body;

  if (typeof isPinned !== "boolean") {
    return res.status(400).json({
      error: true,
      message: "Invalid value for isPinned. It must be a boolean.",
    });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found.",
      });
    }

    note.isPinned = isPinned;
    const updatedNote = await note.save();

    return res.status(200).json({
      error: false,
      message: `Note ${isPinned ? "pinned" : "unpinned"} successfully.`,
      note: updatedNote,
    });
  } catch (error) {
    console.error("Error updating note pin status:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

app.get("/search-notes", authenticateToken, async (req, res) => {
  const { user } = req.user; // Extract authenticated user
  const { query } = req.query; // Extract search query from request

  if (!query) {
    return res.status(400).json({
      error: true,
      message: "Search query is required.",
    });
  }

  try {
    // Search notes belonging to the user
    const notes = await Note.find({
      userId: user._id,
      $or: [
        { title: { $regex: query, $options: "i" } }, // Case-insensitive search in title
        { content: { $regex: query, $options: "i" } }, // Case-insensitive search in content
        { tags: { $regex: query, $options: "i" } }, // Case-insensitive search in tags
      ],
    });

    // if (notes.length === 0) {
    //   return res.status(404).json({
    //     error: false,
    //     message: "No notes found matching the search criteria.",
    //     notes: [],
    //   });
    // }

    return res.status(200).json({
      error: false,
      message: "Notes retrieved successfully.",
      notes,
    });
  } catch (error) {
    console.error("Error searching notes:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
