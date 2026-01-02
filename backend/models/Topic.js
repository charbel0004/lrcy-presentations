const mongoose = require("mongoose");

const TopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, minlength: 3, maxlength: 120 },
    description: { type: String, default: "" },

    isAssigned: { type: Boolean, required: true, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedAt: { type: Date, default: null },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model("Topic", TopicSchema);
