import mongoose from "mongoose";

const ScheduleBookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleSlot", required: true, index: true },

    status: { type: String, required: true, enum: ["CONFIRMED", "CANCELLED"], default: "CONFIRMED" },
    confirmedAt: { type: Date, required: true, default: Date.now },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: false }
);

export const ScheduleBooking =
  mongoose.models.ScheduleBooking || mongoose.model("ScheduleBooking", ScheduleBookingSchema);
