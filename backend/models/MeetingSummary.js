const mongoose = require("mongoose");

const meetingSummarySchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
    },
    summary: {
      type: String,
      required: true,
    },
    keyPoints: {
      type: [String],
      default: [],
    },
    actionItems: [
      {
        task: {
          type: String,
          required: true,
        },
        assignee: {
          type: String,
          default: null,
        },
        deadline: {
          type: String,
          default: null,
        },
      },
    ],
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MeetingSummary", meetingSummarySchema);