
const Student = require("../src/models/Student");
const Teacher = require("../src/models/Teacher");
const moment = require("moment");

const { authorizeCalendar } = require("../src/calendar/calendarAuth");
const { scheduleMonth } = require("../src/calendar/utils/scheduleV2");

async function update() {
    
    const students = await Student.find({});
    console.log(students);
    students.map(async (student) => {
      const teacher = await Teacher.findOne({ _id: student.teacherId });
      
      const dayToFind = student.lessonTime.lessonDay;
      let searchDate = moment(new Date());
      searchDate = searchDate.add(1, "month").startOf("month");

      if(moment(student.lessonTime.firstLesson).isAfter(searchDate)) {
        return null;
      }

      while (searchDate.day() !== dayToFind) {
        searchDate.add(1, "day");
      }

      student.lessonTime.firstLesson = searchDate.toDate();
      //student.lessonTime.firstLesson = something
      console.log(student.lessonTime)

      authorizeCalendar(teacher, student, scheduleMonth);
    })
}

update();