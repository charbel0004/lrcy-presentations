import mongoose from "mongoose";

const ScheduleSlotSchema = new mongoose.Schema(
  {
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },

    capacity: { type: Number, required: true, min: 1, default: 1 },

    location: { type: String, default: null, maxlength: 200 },
    notes: { type: String, default: null, maxlength: 500 },

    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

// Prevent duplicate exact slot start times (optional but useful)
ScheduleSlotSchema.index({ startAt: 1 }, { unique: true });

export const ScheduleSlot =
  mongoose.models.ScheduleSlot || mongoose.model("ScheduleSlot", ScheduleSlotSchema);
