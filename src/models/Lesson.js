const mongoose = require("mongoose");

const Lesson = mongoose.model("Lesson", {
  lessonDate: {
    type: Date,
    required: true,
  },
  taught: {
    type: Boolean,
    default: false,
  },
  cancelled: {
    type: Boolean,
    default: false,
  },
  noShow: {
    type: Boolean,
    default: false,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Student",
  },
  calendarId: {
    type: String,
    required: true,
  },
});

module.exports = Lesson;
