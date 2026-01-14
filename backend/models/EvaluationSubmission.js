import mongoose from "mongoose";

const ScoreSchema = new mongoose.Schema(
  {
    criterionId: { type: mongoose.Schema.Types.ObjectId, ref: "EvaluationCriterion", required: true },
    score: { type: Number, required: true, min: 1, max: 10 },
  },
  { _id: false }
);

const EvaluationSubmissionSchema = new mongoose.Schema(
  {
    evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    presenterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    slotId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleSlot", default: null },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },

    scores: { type: [ScoreSchema], required: true, minlength: 1 },

    comment: { type: String, required: true, maxlength: 2000 },

    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

// One evaluation per evaluator per presenter
EvaluationSubmissionSchema.index({ evaluatorId: 1, presenterId: 1 }, { unique: true });

export const EvaluationSubmission =
  mongoose.models.EvaluationSubmission || mongoose.model("EvaluationSubmission", EvaluationSubmissionSchema);
