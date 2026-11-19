const Meeting = require("../models/Meeting");
const MeetingSummary = require("../models/MeetingSummary");
const {
  generateMeetingIntelligence,
} = require("../services/aiService");

const generateSummary = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { meetingText } = req.body || {};

    if (
      typeof meetingText !== "string" ||
      !meetingText.trim() ||
      meetingText.length > 30000
    ) {
      return res.status(400).json({
        message: "Meeting text must contain 1 to 30000 characters",
      });
    }

    const meeting = await Meeting.findOne({
      meetingId,
      $or: [
        { host: req.user._id },
        { participants: req.user._id },
      ],
    });

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found or access denied",
      });
    }

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the meeting host can generate AI summaries",
      });
    }

    const result = await generateMeetingIntelligence(meetingText);

    const savedSummary = await MeetingSummary.findOneAndUpdate(
      { meeting: meeting._id },
      {
        $set: {
          summary: result.summary,
          keyPoints: result.keyPoints,
          actionItems: result.actionItems,
          generatedBy: req.user._id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      message: "AI meeting summary generated successfully",
      summary: savedSummary,
    });
  } catch (error) {
    console.error("AI generation error:", error.message);

    res.status(500).json({
      message: "Failed to generate AI summary",
    });
  }
};

const getSummary = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
      $or: [
        { host: req.user._id },
        { participants: req.user._id },
      ],
    });

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found or access denied",
      });
    }

    const summary = await MeetingSummary.findOne({
      meeting: meeting._id,
    });

    if (!summary) {
      return res.status(404).json({
        message: "No AI summary found for this meeting",
      });
    }

    res.status(200).json({
      message: "AI summary fetched successfully",
      summary,
    });
  } catch (error) {
    console.error("Fetch AI summary error:", error.message);

    res.status(500).json({
      message: "Failed to fetch AI summary",
    });
  }
};

module.exports = {
  generateSummary,
  getSummary,
};