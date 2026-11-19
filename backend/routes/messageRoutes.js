const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getMeetingMessages,
} = require("../controllers/messageController");

const router = express.Router();

router.use(protect);

router.get("/:meetingId", getMeetingMessages);

module.exports = router;