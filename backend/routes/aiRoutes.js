const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  generateSummary,
  getSummary,
} = require("../controllers/aiController");

const router = express.Router();

router.use(protect);

router.post("/:meetingId/generate", generateSummary);

router.get("/:meetingId", getSummary);

module.exports = router;