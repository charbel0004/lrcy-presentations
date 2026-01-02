const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, minlength: 3, maxlength: 120 },
    username: { type: String, required: true, minlength: 3, maxlength: 120 },
    passwordHash: { type: String, required: true, minlength: 20 },
    role: { type: String, required: true, enum: ["admin", "presenter"] },

    hasSpun: { type: Boolean, required: true, default: false },
    assignedTopicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedAt: { type: Date, default: null },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model("User", UserSchema);
