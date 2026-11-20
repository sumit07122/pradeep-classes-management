import React from "react";
import { BookOpen, FileText, Award } from "lucide-react";

export const Academics: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">ACADEMIC CURRICULUM</div>
          <h1>Academic Management</h1>
          <p>Syllabus progression, weekly tests, homework assignments, and study materials.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <BookOpen size={18} className="text-[#16466f]" />
            <h3>Courses & Syllabus</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Curriculum tracking for Physics, Chemistry, and Mathematics across Board and Competitive batches.
          </p>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-emerald-600 font-bold">5 Active Subjects</span>
            <span className="text-slate-400">Term 1</span>
          </div>
        </div>

        <div className="panel space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <Award size={18} className="text-amber-600" />
            <h3>Tests & Results</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Weekly evaluation exams, rank tracking, scorecards, and performance analysis.
          </p>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-amber-700 font-bold">Next Test: Sunday</span>
            <span className="text-slate-400">JEE Mock #4</span>
          </div>
        </div>

        <div className="panel space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <FileText size={18} className="text-purple-600" />
            <h3>Study Materials</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Curated problem sheets, formula handbooks, and previous year exam questions.
          </p>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-purple-700 font-bold">24 PDFs Uploaded</span>
            <span className="text-slate-400">Cloud Storage</span>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Upcoming Examinations & Deadlines</h3>
            <p>Scheduled assessments for students</p>
          </div>
        </div>
        <div className="schedule-list">
          <div className="schedule-item">
            <time>Sunday 23 Nov</time>
            <i className="blue" />
            <div>
              <b>Physics Thermodynamics Test · JEE Morning</b>
              <small>Duration: 3 Hours • Max Marks: 100</small>
            </div>
            <span className="schedule-status">Upcoming</span>
          </div>
          <div className="schedule-item">
            <time>Tuesday 25 Nov</time>
            <i className="violet" />
            <div>
              <b>Organic Chemistry Reaction Mechanisms · NEET Evening</b>
              <small>Duration: 1.5 Hours • Max Marks: 50</small>
            </div>
            <span className="schedule-status">Upcoming</span>
          </div>
        </div>
      </section>
    </div>
  );
};
