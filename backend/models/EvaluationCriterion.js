import mongoose from "mongoose";

const EvaluationCriteriaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 120,
      trim: true,
    },

    description: {
      type: String,
      default: null,
      maxlength: 500,
      trim: true,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
      unique: true, // IMPORTANT: one criterion per order
    },

    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },

    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: "evaluationCriteria",
    versionKey: false,
  }
);

// Explicit index (Mongo will enforce uniqueness)
EvaluationCriteriaSchema.index({ order: 1 }, { unique: true });

export const EvaluationCriteria =
  mongoose.models.EvaluationCriteria ||
  mongoose.model("EvaluationCriteria", EvaluationCriteriaSchema);
