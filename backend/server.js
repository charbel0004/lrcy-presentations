import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Int32 } from "bson";

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

const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";

/* ---------------------------
   Models
--------------------------- */

const TopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, minlength: 3, maxlength: 120, trim: true },
    description: { type: String, default: "", trim: true },

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
    fullName: { type: String, required: true, minlength: 3, maxlength: 120, trim: true },
    username: { type: String, required: true, minlength: 3, maxlength: 120, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["admin", "presenter", "evaluator"],
      default: "presenter",
    },

    // Presenter wheel
    hasSpun: { type: Boolean, required: true, default: false },
    assignedTopicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedAt: { type: Date, default: null },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: "users", versionKey: false }
);

UserSchema.index({ username: 1 }, { unique: true });

const EvaluationSchema = new mongoose.Schema(
  {
    presenterId: { type: mongoose.Schema.Types.ObjectId, required: true },
    evaluatorId: { type: mongoose.Schema.Types.ObjectId, required: true },

    criteria: [
      {
        criterionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        title: { type: String, required: true },
        order: { type: Number, required: true },
        score: { type: Number, required: true, min: 1, max: 10 },
      },
    ],

    // NEW: evaluator comment (optional)
    comment: { type: String, default: "", trim: true, maxlength: 1500 },

    totalScore: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: "evaluations", versionKey: false }
);

// Prevent same evaluator from evaluating same presenter twice
EvaluationSchema.index({ presenterId: 1, evaluatorId: 1 }, { unique: true });

const Evaluation = mongoose.models.Evaluation || mongoose.model("Evaluation", EvaluationSchema);

const EvaluationCriteriaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, minlength: 2, maxlength: 120, trim: true },
    description: { type: String, default: null, maxlength: 500, trim: true },
    // Stored as Int32 in Mongo via native insert; Mongoose reads it as a Number in JSON.
    order: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: "evaluationCriteria", versionKey: false }
);

const Topic = mongoose.model("Topic", TopicSchema);
const User = mongoose.model("User", UserSchema);
const EvaluationCriteria =
  mongoose.models.EvaluationCriteria || mongoose.model("EvaluationCriteria", EvaluationCriteriaSchema);

/* ---------------------------
   Auth helpers
--------------------------- */

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
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

/**
 * Admin should have access to everything.
 * - If user.role === "admin" => always allow.
 * - Otherwise, user.role must match one of the allowed roles.
 *
 * Usage:
 *   requireRole("admin")                  // admin only
 *   requireRole("presenter")              // presenter OR admin
 *   requireRole("evaluator")              // evaluator OR admin
 *   requireRole("presenter","evaluator")  // either OR admin
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;

    if (!role) return res.status(403).json({ message: "Forbidden." });

    // Admin is superuser
    if (role === "admin") return next();

    // Otherwise role must be one of allowed
    if (!roles.includes(role)) return res.status(403).json({ message: "Forbidden." });

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
    const topics = await Topic.find({ isAssigned: false }).select("title").sort({ createdAt: 1 }).lean();
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
  if (existingAdmin) return res.status(409).json({ message: "Admin already exists." });

  if (!fullName || !username || !password) {
    return res.status(400).json({ message: "fullName, username, password are required." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await User.create({
    fullName: String(fullName).trim(),
    username: String(username).trim().toLowerCase(),
    passwordHash,
    role: "admin",
  });

  return res.json({ ok: true, adminId: admin._id });
});

/**
 * Admin creates user accounts (presenter / evaluator / admin)
 */
app.post("/api/admin/users", authGuard, requireRole("admin"), async (req, res) => {
  const { fullName, username, password, role } = req.body;

  const fn = String(fullName || "").trim();
  const un = String(username || "").trim().toLowerCase();
  const pw = String(password || "");
  const rl = String(role || "presenter").trim();

  if (fn.length < 3) return res.status(400).json({ message: "Full name is required." });
  if (un.length < 3) return res.status(400).json({ message: "Username is required." });
  if (!pw || pw.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
  if (!["presenter", "evaluator", "admin"].includes(rl)) return res.status(400).json({ message: "Invalid role." });

  try {
    const passwordHash = await bcrypt.hash(pw, 12);

    const user = await User.create({
      fullName: fn,
      username: un,
      passwordHash,
      role: rl,
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
  const p = String(password || "");
  if (!u || !p) return res.status(400).json({ message: "username and password required." });

  const user = await User.findOne({ username: u });
  if (!user) return res.status(401).json({ message: "Invalid credentials." });

  const ok = await bcrypt.compare(p, user.passwordHash);
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
 * Admin can access too (superuser), but logic still enforces one spin per user.
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

    res.json({ topic: { id: topic._id, title: topic.title, description: topic.description || "" } });
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
 * Admin can access too.
 */
app.get("/api/presenter/me", authGuard, requireRole("presenter"), async (req, res) => {
  const user = await User.findById(req.user.sub).lean();
  if (!user) return res.status(404).json({ message: "User not found." });

  if (!user.assignedTopicId) return res.json({ hasSpun: user.hasSpun, topic: null });

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

    const topics = topicIds.length ? await Topic.find({ _id: { $in: topicIds } }).select("title").lean() : [];

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
   Evaluation Criteria (Admin)
--------------------------- */

app.get("/api/admin/evaluation-criteria", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const criteria = await EvaluationCriteria.find({})
      .select("title description order isActive createdAt")
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.json({ criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load evaluation criteria." });
  }
});

app.post("/api/admin/evaluation-criteria", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const { title, description, order, isActive } = req.body || {};

    const t = String(title || "").trim();
    if (t.length < 2 || t.length > 120) {
      return res.status(400).json({ message: "title must be 2 to 120 characters." });
    }

    const ord = Number(order);
    if (!Number.isInteger(ord) || ord < 1) {
      return res.status(400).json({ message: "order must be an integer >= 1." });
    }

    // description: allow null OR string, max 500
    let desc = null;
    if (description !== undefined && description !== null) {
      desc = String(description).trim();
      if (desc.length > 500) return res.status(400).json({ message: "description max length is 500." });
      if (desc.length === 0) desc = null;
    }

    const doc = {
      title: t,
      description: desc, // string | null
      order: new Int32(ord), // BSON int
      isActive: isActive === undefined ? true : !!isActive,
      createdAt: new Date(),
    };

    const result = await mongoose.connection.collection("evaluationCriteria").insertOne(doc);

    return res.json({ ok: true, id: result.insertedId });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "A criterion with this order already exists." });
    }
    console.error("Add criterion failed:", e);
    return res.status(500).json({ message: "Failed to add criterion." });
  }
});

app.patch("/api/admin/evaluation-criteria/:id/toggle", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid criterion id." });

    const next = !!isActive;

    const updated = await mongoose.connection.collection("evaluationCriteria").findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { isActive: next } },
      { returnDocument: "after" }
    );

    if (!updated?.value) return res.status(404).json({ message: "Criterion not found." });

    return res.json({ ok: true, criterion: updated.value });
  } catch (e) {
    console.error("Toggle criterion failed:", e);
    return res.status(500).json({ message: "Failed to toggle criterion." });
  }
});

/* ---------------------------
   Evaluator Routes
   Admin must also be allowed => requireRole("evaluator")
   (admin passes automatically via requireRole)
--------------------------- */

/**
 * Evaluator: list presenters who have spun (+ topic) + whether I evaluated them
 * GET /api/evaluator/presenters
 */
app.get("/api/evaluator/presenters", authGuard, requireRole("evaluator"), async (req, res) => {
  try {
    const evaluatorId = new mongoose.Types.ObjectId(req.user.sub);

    const presenters = await User.find({ role: "presenter", hasSpun: true })
      .select("fullName username hasSpun assignedTopicId assignedAt createdAt")
      .sort({ assignedAt: 1, createdAt: 1 })
      .lean();

    const topicIds = presenters.map((p) => p.assignedTopicId).filter(Boolean);

    const topics = topicIds.length
      ? await Topic.find({ _id: { $in: topicIds } }).select("title description").lean()
      : [];

    const topicMap = new Map(topics.map((t) => [String(t._id), t]));

    const myEvals = await Evaluation.find({ evaluatorId }).select("presenterId createdAt totalScore").lean();

    const evalMap = new Map(myEvals.map((e) => [String(e.presenterId), e]));

    const result = presenters.map((p) => {
      const t = p.assignedTopicId ? topicMap.get(String(p.assignedTopicId)) : null;
      const ev = evalMap.get(String(p._id)) || null;

      return {
        _id: p._id,
        fullName: p.fullName,
        username: p.username,
        hasSpun: p.hasSpun,
        assignedAt: p.assignedAt,
        topic: t ? { _id: t._id, title: t.title, description: t.description || "" } : null,
        myEvaluation: ev ? { createdAt: ev.createdAt, totalScore: ev.totalScore } : null,
      };
    });

    return res.json({ presenters: result });
  } catch (e) {
    console.error("Evaluator presenters failed:", e);
    return res.status(500).json({ message: "Failed to load presenters." });
  }
});

/**
 * Evaluator: active criteria only (sorted by order)
 * GET /api/evaluator/evaluation-criteria
 */
app.get("/api/evaluator/evaluation-criteria", authGuard, requireRole("evaluator"), async (req, res) => {
  try {
    const criteria = await EvaluationCriteria.find({ isActive: true })
      .select("title description order")
      .sort({ order: 1, createdAt: 1 })
      .lean();

    return res.json({ criteria });
  } catch (e) {
    console.error("Evaluator criteria failed:", e);
    return res.status(500).json({ message: "Failed to load evaluation criteria." });
  }
});

/**
 * Evaluator: submit evaluation for a presenter
 * POST /api/evaluator/evaluations
 */
app.post("/api/evaluator/evaluations", authGuard, requireRole("evaluator"), async (req, res) => {
  try {
    const evaluatorId = new mongoose.Types.ObjectId(req.user.sub);
    const { presenterId, scores, comment } = req.body || {};

    if (!mongoose.isValidObjectId(presenterId)) {
      return res.status(400).json({ message: "Invalid presenterId." });
    }

    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: "scores array is required." });
    }

    // NEW: comment validation (optional)
    let cm = "";
    if (comment !== undefined && comment !== null) {
      cm = String(comment).trim();
      if (cm.length > 1500) {
        return res.status(400).json({ message: "comment max length is 1500 characters." });
      }
    }

    const presenter = await User.findOne({ _id: presenterId, role: "presenter", hasSpun: true }).select("_id").lean();
    if (!presenter) {
      return res.status(404).json({ message: "Presenter not found or has not spun." });
    }

    const active = await EvaluationCriteria.find({ isActive: true }).select("title order").sort({ order: 1 }).lean();
    if (!active.length) {
      return res.status(409).json({ message: "No active criteria available." });
    }

    const activeMap = new Map(active.map((c) => [String(c._id), c]));

    const seen = new Set();
    const rows = [];

    for (const s of scores) {
      const cid = String(s?.criterionId || "");
      if (!mongoose.isValidObjectId(cid)) return res.status(400).json({ message: "Invalid criterionId." });
      if (!activeMap.has(cid)) return res.status(400).json({ message: "One or more criteria are not active." });
      if (seen.has(cid)) return res.status(400).json({ message: "Duplicate criterionId in scores." });
      seen.add(cid);

      const score = parseInt(String(s?.score), 10);
      if (!Number.isInteger(score) || score < 1 || score > 10) {
        return res.status(400).json({ message: "Scores must be integers from 1 to 10." });
      }

      const meta = activeMap.get(cid);
      rows.push({
        criterionId: new mongoose.Types.ObjectId(cid),
        title: meta.title,
        order: meta.order,
        score,
      });
    }

    if (seen.size !== active.length) {
      return res.status(400).json({ message: "You must score all active criteria." });
    }

    const totalScore = rows.reduce((sum, r) => sum + r.score, 0);

    const doc = await Evaluation.create({
      presenterId: new mongoose.Types.ObjectId(presenterId),
      evaluatorId,
      criteria: rows.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999)),
      comment: cm, // NEW: save comment
      totalScore,
      createdAt: new Date(),
    });

    return res.json({ ok: true, evaluationId: doc._id, totalScore });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "You already evaluated this presenter." });
    }
    console.error("Submit evaluation failed:", e);
    return res.status(500).json({ message: "Failed to submit evaluation." });
  }
});





app.get("/api/admin/presenters-reports", authGuard, requireRole("admin"), async (req, res) => {
  try {
    const usersCol = mongoose.connection.collection("users");

    const pipeline = [
      // 1) Only presenters who have spun
      {
        $match: {
          role: "presenter",
          hasSpun: true,
        },
      },

      // 2) Join topic
      {
        $lookup: {
          from: "topics",
          localField: "assignedTopicId",
          foreignField: "_id",
          as: "topic",
        },
      },
      { $unwind: { path: "$topic", preserveNullAndEmptyArrays: true } },

      // 3) Join evaluations for that presenter
      {
        $lookup: {
          from: "evaluations",
          let: { pid: "$_id" },
          pipeline: [
            // Match evaluations for this presenter
            { $match: { $expr: { $eq: ["$presenterId", "$$pid"] } } },

            // 3.a) Join evaluator user to get evaluator name
            {
              $lookup: {
                from: "users",
                localField: "evaluatorId",
                foreignField: "_id",
                as: "evaluator",
              },
            },
            { $unwind: { path: "$evaluator", preserveNullAndEmptyArrays: true } },

            // 3.b) Shape each evaluation row (✅ INCLUDE comment)
            {
              $project: {
                _id: 1,
                evaluatorId: 1,
                evaluatorName: "$evaluator.fullName",
                evaluatorUsername: "$evaluator.username",
                totalScore: 1,
                createdAt: 1,

                // ✅ Fix: return comment so UI can show it
                comment: {
                  $let: {
                    vars: {
                      c1: { $ifNull: ["$comment", ""] },   // current field
                      c2: { $ifNull: ["$comments", ""] },  // fallback if old docs used "comments"
                      c3: { $ifNull: ["$feedback", ""] },  // fallback if old docs used "feedback"
                    },
                    in: {
                      $cond: [
                        { $gt: [{ $strLenCP: "$$c1" }, 0] },
                        "$$c1",
                        {
                          $cond: [
                            { $gt: [{ $strLenCP: "$$c2" }, 0] },
                            "$$c2",
                            "$$c3",
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },

            { $sort: { createdAt: 1 } },
          ],
          as: "evaluations",
        },
      },

      // 4) Compute metrics
      {
        $addFields: {
          evalCount: { $size: "$evaluations" },
          avgTotalScore: {
            $cond: [
              { $gt: [{ $size: "$evaluations" }, 0] },
              { $avg: "$evaluations.totalScore" },
              null,
            ],
          },
          sumTotalScore: {
            $cond: [
              { $gt: [{ $size: "$evaluations" }, 0] },
              { $sum: "$evaluations.totalScore" },
              0,
            ],
          },
        },
      },

      // 5) Final projection
      {
        $project: {
          _id: 1,
          fullName: 1,
          username: 1,
          assignedAt: 1,

          topic: {
            _id: "$topic._id",
            title: "$topic.title",
            description: "$topic.description",
          },

          evalCount: 1,
          avgTotalScore: 1,
          sumTotalScore: 1,
          evaluations: 1,
        },
      },

      // 6) Sort presenters
      { $sort: { assignedAt: 1, createdAt: 1 } },
    ];

    const rows = await usersCol.aggregate(pipeline).toArray();

    return res.json({ presenters: rows });
  } catch (e) {
    console.error("Admin presenters reports failed:", e);
    return res.status(500).json({ message: "Failed to load presenters report." });
  }
});

/* ---------------------------
   Start server
--------------------------- */

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });
    console.log("MongoDB connected");
    app.listen(PORT, HOST, () => console.log(`Backend running on port ${PORT}`));
  } catch (err) {
    console.error("Startup error:", err.message);
    process.exit(1);
  }
}

start();
