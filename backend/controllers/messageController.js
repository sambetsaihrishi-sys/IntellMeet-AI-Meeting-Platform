const Meeting = require("../models/Meeting");
const Message = require("../models/Message");

const getMeetingMessages = async (req, res) => {
  try {
    const { meetingId } = req.params;

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

    const messages = await Message.find({
      meeting: meeting._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      message: "Chat history fetched successfully",
      messages: messages.reverse().map((item) => ({
        id: item._id.toString(),
        senderId: item.sender.toString(),
        senderName: item.senderName,
        message: item.message,
        timestamp: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get messages error:", error.message);

    res.status(500).json({
      message: "Failed to fetch chat history",
    });
  }
};

module.exports = {
  getMeetingMessages,
};