import { useEffect, useState } from "react";
import API from "../../services/api";
import StudentDrawer from "../student/StudentDrawer";
import "./AdminStudentsList.css";

const AdminStudentsList = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    API.get("/admin/students").then((res) =>
      setStudents(res.data.students || [])
    );
  }, []);

  return (
    <div className="page-shell">
      <div className="page-inner admin-students">
        {/* ================= HEADER ================= */}
        <div className="dash-header">
          <h2 className="section-title">Students</h2>
          <p className="muted">Click a student to view detailed profile.</p>
        </div>

        {/* ================= LIST ================= */}
        <div className="student-list">
          {students.map((s) => (
            <button
              key={s._id}
              onClick={() => setSelectedStudent(s._id)}
              className="student-row"
              type="button"
            >
              <img
                src={s.avatar?.secure_url}
                className="student-avatar"
                alt={s.fullname}
              />
              <div>
                <p className="student-name">{s.fullname}</p>
                <p className="student-email">{s.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ================= DRAWER ================= */}
      {selectedStudent && (
        <StudentDrawer
          studentId={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

export default AdminStudentsList;
