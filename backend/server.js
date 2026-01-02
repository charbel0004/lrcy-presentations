import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(express.json());

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

const PORT = process.env.PORT || 4000;

/* ---------------------------
   Models
--------------------------- */

const TopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, minlength: 3, maxlength: 120 },
    description: { type: String, default: "" },

    isAssigned: { type: Boolean, required: true, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedAt: { type: Date, default: null },

    createdAt: { type: Date, required: true, default: Date.now },
    createdBy: { type: String, required: true, enum: ["admin"], default: "admin" },
  },
  { collection: "topics", versionKey: false }
);

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, minlength: 3, maxlength: 120 },
    username: { type: String, required: true, minlength: 3, maxlength: 120 },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["admin", "presenter"], default: "presenter" },

    hasSpun: { type: Boolean, required: true, default: false },
    assignedTopicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedAt: { type: Date, default: null },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: "users", versionKey: false }
);

UserSchema.index({ username: 1 }, { unique: true });

const Topic = mongoose.model("Topic", TopicSchema);
const User = mongoose.model("User", UserSchema);

/* ---------------------------
   Auth helpers
--------------------------- */

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authGuard(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token." });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user?.role || req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden." });
    }
    next();
  };
}

/* ---------------------------
   Routes
--------------------------- */

app.get("/api/healthz", (req, res) => res.json({ ok: true }));

/**
 * Public: available topics (for wheel labels)
 */
app.get("/api/topics/available", async (req, res) => {
  try {
    const topics = await Topic.find({ isAssigned: false })
      .select("title")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ topics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load topics." });
  }
});

/**
 * Bootstrap: create first admin (only if none exists)
 */
app.post("/api/bootstrap/admin", async (req, res) => {
  const { fullName, username, password } = req.body;

  const existingAdmin = await User.findOne({ role: "admin" }).lean();
  if (existingAdmin) {
    return res.status(409).json({ message: "Admin already exists." });
  }

  if (!fullName || !username || !password) {
    return res.status(400).json({ message: "fullName, username, password are required." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await User.create({
    fullName: fullName.trim(),
    username: username.trim().toLowerCase(),
    passwordHash,
    role: "admin",
  });

  return res.json({ ok: true, adminId: admin._id });
});

/**
 * Admin creates presenter accounts
 */
app.post("/api/admin/users", authGuard, requireRole("admin"), async (req, res) => {
  const { fullName, username, password } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ message: "fullName, username, password are required." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      passwordHash,
      role: "presenter",
    });

    res.json({ ok: true, userId: user._id });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "Username already exists." });
    console.error(e);
    res.status(500).json({ message: "Failed to create user." });
  }
});

/**
 * Login
 */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  const u = String(username || "").trim().toLowerCase();
  if (!u || !password) return res.status(400).json({ message: "username and password required." });

  const user = await User.findOne({ username: u });
  if (!user) return res.status(401).json({ message: "Invalid credentials." });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials." });

  const token = signToken(user);

  res.json({
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      hasSpun: user.hasSpun,
      assignedTopicId: user.assignedTopicId,
    },
  });
});

/**
 * Presenter: spin once (assign topic)
 */
app.post("/api/presenter/spin", authGuard, requireRole("presenter"), async (req, res) => {
  const userId = req.user.sub;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found." });
    }

    if (user.hasSpun) {
      await session.abortTransaction();
      return res.status(409).json({ message: "You already spun the wheel." });
    }

    const topic = await Topic.findOneAndUpdate(
      { isAssigned: false },
      { $set: { isAssigned: true, assignedAt: new Date() } },
      { sort: { _id: 1 }, new: true, session }
    );

    if (!topic) {
      await session.abortTransaction();
      return res.status(409).json({ message: "No topics available." });
    }

    user.hasSpun = true;
    user.assignedTopicId = topic._id;
    user.assignedAt = new Date();
    await user.save({ session });

    topic.assignedTo = user._id;
    topic.assignedAt = new Date();
    await topic.save({ session });

    await session.commitTransaction();

    res.json({
      topic: { id: topic._id, title: topic.title, description: topic.description || "" },
    });
  } catch (e) {
    await session.abortTransaction();
    console.error(e);
    res.status(500).json({ message: "Spin failed." });
  } finally {
    session.endSession();
  }
});

/**
 * Presenter: get my assigned topic (if any)
 */
app.get("/api/presenter/me", authGuard, requireRole("presenter"), async (req, res) => {
  const user = await User.findById(req.user.sub).lean();
  if (!user) return res.status(404).json({ message: "User not found." });

  if (!user.assignedTopicId) {
    return res.json({ hasSpun: user.hasSpun, topic: null });
  }

  const topic = await Topic.findById(user.assignedTopicId).select("title description").lean();
  return res.json({
    hasSpun: user.hasSpun,
    topic: topic ? { title: topic.title, description: topic.description || "" } : null,
  });
});

/**
 * Admin: topics add
 */
app.post("/api/admin/topics", authGuard, requireRole("admin"), async (req, res) => {
  const { topics } = req.body;
  if (!Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({ message: "topics array is required." });
  }

  const docs = topics
    .map((t) => ({
      title: String(t.title || "").trim(),
      description: String(t.description || "").trim(),
      isAssigned: false,
      assignedTo: null,
      assignedAt: null,
      createdAt: new Date(),
      createdBy: "admin",
    }))
    .filter((t) => t.title.length >= 3);

  if (!docs.length) return res.status(400).json({ message: "No valid topics provided." });

  const inserted = await Topic.insertMany(docs, { ordered: false });
  res.json({ inserted: inserted.length });
});

/**
 * Admin: overview
 */
app.get("/api/admin/overview", authGuard, requireRole("admin"), async (req, res) => {
  const total = await Topic.countDocuments();
  const available = await Topic.countDocuments({ isAssigned: false });
  const assigned = await Topic.countDocuments({ isAssigned: true });
  const presenters = await User.countDocuments({ role: "presenter" });
  const spun = await User.countDocuments({ role: "presenter", hasSpun: true });

  res.json({ total, available, assigned, presenters, spun });
});

/**
 * Admin: presenters list + topic title (for dashboard)
 */
app.get("/api/admin/presenters", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const presenters = await User.find({ role: "presenter" })
      .select("fullName username hasSpun assignedTopicId assignedAt createdAt")
      .sort({ createdAt: 1 })
      .lean();

    const topicIds = presenters.map((p) => p.assignedTopicId).filter(Boolean);

    const topics = topicIds.length
      ? await Topic.find({ _id: { $in: topicIds } }).select("title").lean()
      : [];

    const map = new Map(topics.map((t) => [String(t._id), t.title]));

    const result = presenters.map((p) => ({
      _id: p._id,
      fullName: p.fullName,
      username: p.username,
      hasSpun: p.hasSpun,
      assignedAt: p.assignedAt,
      createdAt: p.createdAt,
      topicTitle: p.assignedTopicId ? map.get(String(p.assignedTopicId)) || null : null,
    }));

    res.json({ presenters: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load presenters." });
  }
});

/* ---------------------------
   Start server
--------------------------- */

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Startup error:", err.message);
    process.exit(1);
  }
}

start();
