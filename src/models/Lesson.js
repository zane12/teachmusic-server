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
  student: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Student",
  },
});

module.exports = Lesson;
