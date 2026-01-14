import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, minlength: 3, maxlength: 120 },
    username: { type: String, required: true, minlength: 3, maxlength: 120, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true, minlength: 20 },

    role: { type: String, required: true, enum: ["admin", "presenter", "evaluator"] },

    isActive: { type: Boolean, default: true },

    hasSpun: { type: Boolean, required: true, default: false },

    assignedTopicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },
    assignedAt: { type: Date, default: null },

    // Optional convenience (you can omit these if you want pure normalization)
    scheduleSlotId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleSlot", default: null },
    scheduledAt: { type: Date, default: null },
  },
  { timestamps: false } // because you already store createdAt manually
);

UserSchema.add({
  createdAt: { type: Date, required: true, default: Date.now },
});

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
