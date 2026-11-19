const express = require("express");

const {
  createMeeting,
  getMeetings,
  getMeetingById,
  deleteMeeting,
  inviteParticipant,
} = require("../controllers/meetingController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", createMeeting);

router.get("/", getMeetings);

router.post("/:meetingId/invite", inviteParticipant);

router.get("/:meetingId", getMeetingById);

router.delete("/:id", deleteMeeting);

module.exports = router;