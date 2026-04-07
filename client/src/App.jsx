import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import NavbarSwitcher from "./components/common/NavbarSwitcher";

import ProtectedRoute from "./components/common/ProtectedRoute";
import PublicRoute from "./components/common/PublicRoute";

import Home from "./pages/Home";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import StudentDashboard from "./components/student/StudentDashboard";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminProfile from "./components/admin/AdminProfile";
import AdminProfileView from "./components/admin/AdminProfileView";
import StudentProfileForm from "./components/student/StudentProfileForm";
import Profile from "./pages/Profile";
import ForgetPassword from "./components/auth/ForgetPassword";
import ResetPassword from "./components/auth/ResetPassword";
import VerifyEmail from "./components/auth/VerifyEmail";
import AdminRegister from "./components/admin/AdminRegister";
import AdminVerifyEmail from "./components/admin/AdminVerifyEmail";
import FooterSwitcher from "./components/common/FooterSwitcher";
import AdminStudentsList from "./components/admin/AdminStudentsList";
import FilterStudents from "./components/admin/FilterStudent";
import PostJob from "./components/job/PostJob";
import JobList from "./components/student/JobList";
import JobDetail from "./components/student/JobDetails";
import ResumeAnalyzer from "./components/student/ResumeAnalyzer";
import InterviewQAGenerator from "./components/student/InterviewQAGenerator";
import MockInterview from "./components/student/MockInterview";


function App() {
  return (
    <Router>
      <NavbarSwitcher />

      <main className="page-wrapper">
        <Routes>
          {/* 🌍 Public */}
          <Route path="/" element={<Home />} />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* 🎓 Student */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/complete-profile"
            element={
              <ProtectedRoute role="student">
                <StudentProfileForm />
              </ProtectedRoute>
            }
          />


          <Route
            path="/student/view-profile"
            element={
              <ProtectedRoute role="student">
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/job"
            element={
              <ProtectedRoute role="student">
                <JobList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/jobs/:jobId"
            element={
              <ProtectedRoute role="student">
                <JobDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/resume-analyzer"
            element={
              <ProtectedRoute role="student">
                <ResumeAnalyzer />
              </ProtectedRoute>
            }
          />

          <Route
            path="/preparation/qa-generator"
            element={
              <ProtectedRoute role="student">
                <InterviewQAGenerator />
              </ProtectedRoute>
            }
          />

           <Route
            path="/preparation/mock-interview"
            element={
              <ProtectedRoute role="student">
                <MockInterview />
              </ProtectedRoute>
            }
          />


          {/* 🛠 Admin */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/forgetPassword" element={<ForgetPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          {/* 🔒 Hidden admin registration routes */}
          <Route path="/admin/secret-register" element={<AdminRegister />} />
          <Route path="/admin/verify-email" element={<AdminVerifyEmail />} />
          <Route
            path="/admin/students"
            element={
              <ProtectedRoute role="admin">
                <AdminStudentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students/pending"
            element={
              <ProtectedRoute role="admin">
                <AdminStudentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students/placed"
            element={
              <ProtectedRoute role="admin">
                <AdminStudentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <ProtectedRoute role="admin">
                <AdminProfileView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile/edit"
            element={
              <ProtectedRoute role="admin">
                <AdminProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/filter-students"
            element={
              <ProtectedRoute role="admin">
                <FilterStudents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/post-job"
            element={
              <ProtectedRoute role="admin">
                <PostJob />
              </ProtectedRoute>
            }
          />
          
        </Routes>
      </main>

      <FooterSwitcher />
    </Router>
  );
}

export default App;
