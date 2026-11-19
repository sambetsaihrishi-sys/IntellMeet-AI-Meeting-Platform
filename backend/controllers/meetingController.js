const Meeting = require("../models/Meeting");
const User = require("../models/User");

const createMeeting = async (req, res) => {
  try {
    const { title, description, scheduledAt } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150 ||
      typeof scheduledAt !== "string"
    ) {
      return res.status(400).json({
        message: "Valid title and scheduled date are required",
      });
    }

    const date = new Date(scheduledAt);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({
        message: "Please provide a valid future meeting date",
      });
    }

    if (
      description !== undefined &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be text",
      });
    }

    const meeting = await Meeting.create({
      title: title.trim(),
      description: description || "",
      scheduledAt: date,
      host: req.user._id,
      participants: [req.user._id],
    });

    res.status(201).json({
      message: "Meeting created successfully",
      meeting,
    });
  } catch (error) {
    console.error("Create meeting error:", error.message);

    res.status(500).json({
      message: "Failed to create meeting",
    });
  }
};

const getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      host: req.user._id,
    })
      .populate("host", "name email")
      .sort({ scheduledAt: 1 });

    res.status(200).json({
      message: "Meetings fetched successfully",
      meetings,
    });
  } catch (error) {
    console.error("Fetch meetings error:", error.message);

    res.status(500).json({
      message: "Failed to fetch meetings",
    });
  }
};

const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
      $or: [
        { host: req.user._id },
        { participants: req.user._id },
      ],
    }).populate("host", "name email");

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found or access denied",
      });
    }

    res.status(200).json({
      message: "Meeting fetched successfully",
      meeting,
      meetingLink: `${process.env.FRONTEND_URL || "http://localhost:5173"}/meeting/${meeting.meetingId}`,
    });
  } catch (error) {
    console.error("Get meeting error:", error.message);

    res.status(500).json({
      message: "Failed to fetch meeting",
    });
  }
};

const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the meeting host can delete this meeting",
      });
    }

    await meeting.deleteOne();

    res.status(200).json({
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid meeting ID",
      });
    }

    console.error("Delete meeting error:", error.message);

    res.status(500).json({
      message: "Failed to delete meeting",
    });
  }
};

const inviteParticipant = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        message: "Valid participant email is required",
      });
    }

    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the host can invite participants",
      });
    }

    if (["completed", "cancelled"].includes(meeting.status)) {
      return res.status(400).json({
        message: "Cannot invite participants to this meeting",
      });
    }

    const participant = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!participant) {
      return res.status(404).json({
        message: "Participant must register before being invited",
      });
    }

    const updatedMeeting = await Meeting.findOneAndUpdate(
      { meetingId, host: req.user._id },
      { $addToSet: { participants: participant._id } },
      { new: true }
    );

    return res.status(200).json({
      message: "Participant added successfully",
      meetingId: updatedMeeting.meetingId,
      participant: {
        id: participant._id,
        name: participant.name,
        email: participant.email,
      },
    });
  } catch (error) {
    console.error("Invite participant error:", error.message);

    return res.status(500).json({
      message: "Failed to invite participant",
    });
  }
};

module.exports = {
  createMeeting,
  getMeetings,
  getMeetingById,
  deleteMeeting,
  inviteParticipant,
};