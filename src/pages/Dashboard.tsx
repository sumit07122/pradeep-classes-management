import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  ClipboardCheck,
  IndianRupee,
  BookOpen,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Plus,
} from "lucide-react";
import { StatCard, Button, EmptyState, LoadingSpinner, Badge } from "../components/common";
import { studentsService } from "../services/studentsService";
import { teachersService } from "../services/teachersService";
import { useAuth } from "../hooks/useAuth";
import type { Student, Teacher } from "../types";

export const Dashboard: React.FC = () => {
  const { isDemoMode } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [studentsRes, teachersRes] = await Promise.all([
        studentsService.getStudents(),
        teachersService.getTeachers(),
      ]);
      setStudents(studentsRes.data);
      setTeachers(teachersRes.data);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading institute analytics..." size="lg" />;
  }

  const activeStudentsCount = students.filter((s) => s.status === "Active").length;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">INSTITUTE OVERVIEW</div>
          <h1>Good afternoon, Administrator</h1>
          <p>Here is what is happening at Pradeep Classes today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/students">
            <Button variant="primary" icon={<Plus size={16} />}>
              Add student
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="stats-grid">
        <StatCard
          title="Total Students"
          value={students.length > 0 ? String(students.length).padStart(2, "0") : "00"}
          delta="+8.2%"
          note="enrolled students"
          icon={Users}
          tone="blue"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Active Teachers"
          value={teachers.length > 0 ? String(teachers.length).padStart(2, "0") : "00"}
          delta="+2"
          note="faculty members"
          icon={GraduationCap}
          tone="violet"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Today's Attendance"
          value={students.length > 0 ? "92%" : "N/A"}
          delta="+3.4%"
          note="vs yesterday"
          icon={ClipboardCheck}
          tone="green"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Fee Collection"
          value={students.length > 0 ? "₹48,500" : "₹0"}
          delta="+12.5%"
          note="this month"
          icon={IndianRupee}
          tone="amber"
          isDemo={isDemoMode}
        />
      </section>

      {/* Center Grid: Attendance & Quick Actions */}
      <div className="content-grid">
        {/* Attendance Summary */}
        <section className="panel attendance-panel">
          <div className="panel-heading">
            <div>
              <h3>Daily Attendance Snapshot</h3>
              <p>Real-time attendance ratio across all batches</p>
            </div>
            <Link to="/attendance" className="text-button">
              View report <ArrowUpRight size={14} />
            </Link>
          </div>

          {students.length === 0 ? (
            <EmptyState
              title="No attendance marked today"
              description="Batch attendance records will appear here once teachers submit daily rolls."
            />
          ) : (
            <>
              <div className="attendance-summary">
                <div className="attendance-ring">
                  <div>
                    <strong>92%</strong>
                    <small>Present today</small>
                  </div>
                </div>
                <div className="attendance-legend">
                  <div className="legend-row">
                    <i className="green" />
                    <span>Present</span>
                    <b>184</b>
                  </div>
                  <div className="legend-row">
                    <i className="red" />
                    <span>Absent</span>
                    <b>12</b>
                  </div>
                  <div className="legend-row">
                    <i className="amber" />
                    <span>Late</span>
                    <b>4</b>
                  </div>
                </div>
              </div>
              <div className="attendance-foot">
                <span>
                  <CheckCircle2 size={15} /> Attendance recorded at 10:30 AM
                </span>
                <span>{activeStudentsCount} active students on roll</span>
              </div>
            </>
          )}
        </section>

        {/* Quick Actions */}
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h3>Quick Actions</h3>
              <p>Common daily administrative tasks</p>
            </div>
          </div>
          <div className="quick-grid">
            <Link to="/students" className="quick-action">
              <div>
                <Users size={17} />
              </div>
              <span>
                <b>Add Student</b>
                <small>Enroll a new candidate</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/attendance" className="quick-action">
              <div>
                <ClipboardCheck size={17} />
              </div>
              <span>
                <b>Mark Attendance</b>
                <small>Open batch register</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/fees" className="quick-action">
              <div>
                <IndianRupee size={17} />
              </div>
              <span>
                <b>Record Payment</b>
                <small>Issue student fee receipt</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/batches" className="quick-action">
              <div>
                <BookOpen size={17} />
              </div>
              <span>
                <b>Create Batch</b>
                <small>Add learning classroom</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      </div>

      {/* Recent Students Table */}
      <section className="panel students-panel">
        <div className="panel-heading">
          <div>
            <h3>Recently Enrolled Students</h3>
            <p>Latest admission records for Pradeep Classes</p>
          </div>
          <Link to="/students" className="text-button">
            View all records <ArrowUpRight size={14} />
          </Link>
        </div>

        {students.length === 0 ? (
          <EmptyState
            title="No students registered yet"
            description="Students added to Pradeep Classes will show here with their admission numbers and assigned batches."
            actionLabel="Add first student"
            onAction={() => {}}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>ADMISSION NO.</th>
                  <th>CLASS</th>
                  <th>BATCH</th>
                  <th>PHONE</th>
                  <th>STATUS</th>
                  {isDemoMode && <th>DATA TYPE</th>}
                </tr>
              </thead>
              <tbody>
                {students.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar">
                          {s.full_name
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <b>{s.full_name}</b>
                      </div>
                    </td>
                    <td className="muted-cell">{s.admission_no}</td>
                    <td>{s.class_name}</td>
                    <td>{s.batch_name}</td>
                    <td>{s.phone}</td>
                    <td>
                      <Badge
                        variant={s.status === "Active" ? "success" : "warning"}
                        size="sm"
                        showDot
                      >
                        {s.status}
                      </Badge>
                    </td>
                    {isDemoMode && (
                      <td>
                        <Badge variant="demo" size="sm">
                          DEMO
                        </Badge>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Grid: Schedule & Fee Snapshot */}
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Today's Lecture Schedule</h3>
              <p>Active batch timetables</p>
            </div>
            <Link to="/academics" className="text-button">
              View full timetable <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="schedule-list">
            <div className="schedule-item">
              <time>08:00 AM</time>
              <i className="blue" />
              <div>
                <b>Physics · JEE Morning</b>
                <small>Amit Kumar • Room 101</small>
              </div>
              <span className="schedule-status font-medium text-emerald-600">Active</span>
            </div>
            <div className="schedule-item">
              <time>10:30 AM</time>
              <i className="violet" />
              <div>
                <b>Chemistry · NEET Evening</b>
                <small>Neha Sharma • Room 204</small>
              </div>
              <span className="schedule-status">Scheduled</span>
            </div>
            <div className="schedule-item">
              <time>04:00 PM</time>
              <i className="green" />
              <div>
                <b>Mathematics · Foundation A</b>
                <small>Rahul Mishra • Hall A</small>
              </div>
              <span className="schedule-status">Scheduled</span>
            </div>
          </div>
        </section>

        <section className="panel fee-panel">
          <div className="panel-heading">
            <div>
              <h3>Fee Collection Progress</h3>
              <p>Monthly target vs realized collections</p>
            </div>
            <Link to="/fees" className="text-button">
              Fee Ledger <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="fee-total">
            <strong>₹48,500</strong>
            <span>of ₹65,000 monthly target</span>
          </div>
          <div className="progress">
            <i style={{ width: "74.6%" }} />
          </div>
          <div className="fee-meta">
            <span>74.6% collection completed</span>
            <b>₹16,500 pending balance</b>
          </div>
          <div className="fee-note">
            <Clock3 size={15} />
            <span>12 students have pending dues this term</span>
          </div>
        </section>
      </div>
    </div>
  );
};
