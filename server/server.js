const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// Your API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from API!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
