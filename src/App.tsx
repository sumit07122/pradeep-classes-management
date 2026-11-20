import { useMemo, useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, ClipboardCheck, IndianRupee,
  BookOpen, CalendarDays, Bell, Search, Plus, Menu, X, ChevronDown,
  MoreHorizontal, ArrowUpRight, Clock3, CheckCircle2, AlertCircle,
  Settings, Download, Filter
} from "lucide-react";
import { demoStudents, demoTeachers, batches } from "./data/demo";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Student } from "./types";

type Page = "Overview" | "Students" | "Teachers" | "Batches" | "Attendance" | "Fees" | "Academics";
const nav: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Students", icon: Users },
  { label: "Teachers", icon: GraduationCap }, { label: "Batches", icon: BookOpen },
  { label: "Attendance", icon: ClipboardCheck }, { label: "Fees", icon: IndianRupee },
  { label: "Academics", icon: CalendarDays }
];

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [students, setStudents] = useState<Student[]>(demoStudents);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [newStudent, setNewStudent] = useState({ full_name: "", class_name: "Class 12", batch_name: batches[0], phone: "" });

  const filteredStudents = useMemo(() => students.filter(s =>
    `${s.full_name} ${s.admission_no} ${s.batch_name} ${s.class_name}`.toLowerCase().includes(query.toLowerCase())
  ), [students, query]);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newStudent.full_name.trim()) return;
    const student: Student = {
      id: crypto.randomUUID(), admission_no: `PC-${new Date().getFullYear()}-${String(students.length + 1).padStart(3, "0")}`,
      ...newStudent, status: "Active"
    };
    if (supabase) {
      const { data, error } = await supabase.from("students").insert({
        admission_no: student.admission_no, full_name: student.full_name,
        class_name: student.class_name, batch_name: student.batch_name,
        phone: student.phone, status: "active"
      }).select().single();
      if (error) { setNotice(`Could not save to database: ${error.message}`); return; }
      if (data) student.id = data.id;
    }
    setStudents(prev => [student, ...prev]);
    setShowAdd(false);
    setNewStudent({ full_name: "", class_name: "Class 12", batch_name: batches[0], phone: "" });
    setNotice(isSupabaseConfigured ? "Student saved successfully." : "Student added in demo mode. Connect Supabase to save records permanently.");
    window.setTimeout(() => setNotice(""), 5000);
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">PC</div>
        <div><strong>Pradeep Classes</strong><span>INSTITUTE MANAGEMENT</span></div>
        <button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button>
      </div>
      <div className="institute-switch"><div className="institute-avatar">P</div><div><b>Pradeep Classes</b><small>Institute workspace</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.label} onClick={() => { setPage(item.label); setMobileNav(false); }} className={`nav-item ${page === item.label ? "active" : ""}`}><item.icon size={18}/><span>{item.label}</span>{item.label === "Attendance" && <i className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><BookOpen size={17}/></div><b>Need a hand?</b><p>Explore the quick guide to get started with your institute.</p><button onClick={() => setNotice("Help guide will be available in the next release.")}>Open quick guide <ArrowUpRight size={13}/></button></div>
        <button className="nav-item"><Settings size={18}/><span>Settings</span></button>
        <div className="profile"><div className="profile-avatar">AD</div><div><b>Administrator</b><small>Institute owner</small></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button>
        <div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div>
        <div className="top-actions"><div className="today"><CalendarDays size={15}/> Friday, 20 November 2026</div><button className="icon-button notification" aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">AD</div></div>
      </header>
      <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow">INSTITUTE OVERVIEW</div><h1>{page === "Overview" ? "Good afternoon, Admin" : page}</h1><p>{page === "Overview" ? "Here’s what’s happening at your institute today." : `Manage your institute's ${page.toLowerCase()} records and activities.`}</p></div><button className="primary-button" onClick={() => page === "Students" ? setShowAdd(true) : setNotice(`${page} creation workflow is coming in the next milestone.`)}><Plus size={17}/>{page === "Students" ? "Add student" : "Create new"}</button></div>
        {notice && <div className="notice"><AlertCircle size={17}/>{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
        {page === "Overview" ? <Overview students={students} setPage={setPage}/> :
         page === "Students" ? <Students students={filteredStudents} query={query} setQuery={setQuery} onAdd={() => setShowAdd(true)}/> :
         page === "Teachers" ? <Teachers/> :
         page === "Batches" ? <Batches/> :
         <ComingSoon page={page}/>}
      </div>
      <footer className="footer"><span>© 2026 Pradeep Classes</span><span>Management workspace <b>•</b> Version 0.1.0</span></footer>
    </main>
    {showAdd && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAdd(false); }}><form className="modal" onSubmit={addStudent}><div className="modal-head"><div><span className="eyebrow">STUDENT RECORD</span><h2>Add new student</h2></div><button type="button" className="icon-button" onClick={() => setShowAdd(false)}><X size={18}/></button></div><label>Student full name<input required autoFocus value={newStudent.full_name} onChange={e => setNewStudent({...newStudent, full_name:e.target.value})} placeholder="Enter student's name"/></label><div className="form-grid"><label>Class / course<select value={newStudent.class_name} onChange={e => setNewStudent({...newStudent,class_name:e.target.value})}><option>Class 10</option><option>Class 11</option><option>Class 12</option><option>JEE Foundation</option><option>NEET</option></select></label><label>Batch<select value={newStudent.batch_name} onChange={e => setNewStudent({...newStudent,batch_name:e.target.value})}>{batches.map(b=><option key={b}>{b}</option>)}</select></label></div><label>Mobile number<input value={newStudent.phone} onChange={e => setNewStudent({...newStudent,phone:e.target.value})} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10}/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-button" type="submit">Save student <ArrowUpRight size={16}/></button></div></form></div>}
  </div>;
}

function Overview({students,setPage}:{students:Student[];setPage:(p:Page)=>void}) {
  return <>
    <section className="stats-grid">
      <Stat title="Total students" value={String(students.length).padStart(2,"0")} delta="+8.2%" note="vs. last month" icon={Users} tone="blue"/>
      <Stat title="Active teachers" value="08" delta="+2" note="new this term" icon={GraduationCap} tone="violet"/>
      <Stat title="Attendance today" value="92%" delta="+3.4%" note="vs. yesterday" icon={ClipboardCheck} tone="green"/>
      <Stat title="Fees collected" value="₹48,500" delta="+12.5%" note="this month" icon={IndianRupee} tone="amber"/>
    </section>
    <div className="content-grid">
      <section className="panel attendance-panel"><div className="panel-heading"><div><h3>Attendance overview</h3><p>Daily student attendance snapshot</p></div><button className="text-button" onClick={()=>setPage("Attendance")}>View report <ArrowUpRight size={14}/></button></div><div className="attendance-summary"><div className="attendance-ring"><div><strong>92%</strong><small>Present today</small></div></div><div className="attendance-legend"><Legend color="green" label="Present" value="184"/><Legend color="red" label="Absent" value="12"/><Legend color="amber" label="Late" value="4"/></div></div><div className="attendance-foot"><span><CheckCircle2 size={15}/> Attendance updated at 10:30 AM</span><span>200 students</span></div></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common institute tasks</p></div></div><div className="quick-grid"><Quick icon={Users} title="Add student" desc="Register a new student" onClick={()=>setPage("Students")}/><Quick icon={ClipboardCheck} title="Take attendance" desc="Mark batch attendance" onClick={()=>setPage("Attendance")}/><Quick icon={IndianRupee} title="Collect fees" desc="Record a fee payment" onClick={()=>setPage("Fees")}/><Quick icon={BookOpen} title="Add batch" desc="Create a learning group" onClick={()=>setPage("Batches")}/></div></section>
    </div>
    <section className="panel students-panel"><div className="panel-heading"><div><h3>Recently added students</h3><p>Latest student registrations</p></div><button className="text-button" onClick={()=>setPage("Students")}>All students <ArrowUpRight size={14}/></button></div><StudentTable students={students.slice(0,4)}/></section>
    <div className="bottom-grid"><section className="panel"><div className="panel-heading"><div><h3>Today's schedule</h3><p>Friday, 20 November</p></div><button className="more-button"><MoreHorizontal size={18}/></button></div><div className="schedule-list"><Schedule time="08:00 AM" subject="Physics · JEE Morning" teacher="Amit Kumar" color="blue"/><Schedule time="10:30 AM" subject="Chemistry · NEET Evening" teacher="Neha Sharma" color="violet"/><Schedule time="04:00 PM" subject="Mathematics · Foundation A" teacher="Rahul Mishra" color="green"/></div></section><section className="panel fee-panel"><div className="panel-heading"><div><h3>Fee collection</h3><p>Monthly collection progress</p></div><button className="more-button"><MoreHorizontal size={18}/></button></div><div className="fee-total"><strong>₹48,500</strong><span>of ₹65,000 target</span></div><div className="progress"><i/></div><div className="fee-meta"><span>74.6% collected</span><b>₹16,500 pending</b></div><div className="fee-note"><Clock3 size={15}/> 12 students have pending dues</div></section></div>
  </>;
}
function Stat({title,value,delta,note,icon:Icon,tone}:{title:string;value:string;delta:string;note:string;icon:typeof Users;tone:string}){return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-bottom"><b>{delta}</b><span>{note}</span></div></div>}
function Legend({color,label,value}:{color:string;label:string;value:string}){return <div className="legend-row"><i className={color}/><span>{label}</span><b>{value}</b></div>}
function Quick({icon:Icon,title,desc,onClick}:{icon:typeof Users;title:string;desc:string;onClick:()=>void}){return <button className="quick-action" onClick={onClick}><div><Icon size={17}/></div><span><b>{title}</b><small>{desc}</small></span><ArrowUpRight size={15}/></button>}
function Schedule({time,subject,teacher,color}:{time:string;subject:string;teacher:string;color:string}){return <div className="schedule-item"><time>{time}</time><i className={color}/><div><b>{subject}</b><small>{teacher}</small></div><span className="schedule-status">Scheduled</span></div>}
function Students({students,query,setQuery,onAdd}:{students:Student[];query:string;setQuery:(s:string)=>void;onAdd:()=>void}){return <section className="panel directory-panel"><div className="directory-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, admission no. or batch..."/></div><button className="secondary-button"><Filter size={15}/> Filters</button><button className="secondary-button"><Download size={15}/> Export</button><button className="primary-button" onClick={onAdd}><Plus size={16}/> Add student</button></div><div className="table-wrap"><StudentTable students={students}/></div><div className="table-footer"><span>Showing <b>{students.length}</b> student records</span><span>Page 1 of 1</span></div></section>}
function StudentTable({students}:{students:Student[]}){return <table className="data-table"><thead><tr><th>STUDENT</th><th>ADMISSION NO.</th><th>CLASS</th><th>BATCH</th><th>PHONE</th><th>STATUS</th><th/></tr></thead><tbody>{students.map(s=><tr key={s.id}><td><div className="student-cell"><div className="student-avatar">{s.full_name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><b>{s.full_name}</b></div></td><td className="muted-cell">{s.admission_no}</td><td>{s.class_name}</td><td>{s.batch_name}</td><td>{s.phone}</td><td><span className={`status ${s.status==="Active"?"status-active":"status-hold"}`}>{s.status}</span></td><td><button className="more-button"><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>}
function Teachers(){return <section className="panel directory-panel"><div className="panel-heading"><div><h3>Teaching team</h3><p>Teachers and their assigned subjects</p></div><button className="primary-button"><Plus size={16}/> Add teacher</button></div><div className="teacher-grid">{demoTeachers.map(t=><div className="teacher-card" key={t.id}><div className="teacher-avatar">{t.full_name.split(" ").map(x=>x[0]).join("")}</div><h3>{t.full_name}</h3><p>{t.subject}</p><div className="teacher-batches"><span>ASSIGNED BATCHES</span>{t.assigned_batches.map(b=><i key={b}>{b}</i>)}</div><div className="teacher-phone">{t.phone}</div></div>)}</div></section>}
function Batches(){return <section className="panel directory-panel"><div className="panel-heading"><div><h3>Courses & batches</h3><p>Organise students into learning groups</p></div><button className="primary-button"><Plus size={16}/> Create batch</button></div><div className="batch-grid">{batches.map((b,i)=><div className="batch-card" key={b}><div className={`batch-icon tone-${i%4}`}><BookOpen size={19}/></div><div><h3>{b}</h3><p>{[42,36,28,21][i]} students · {["Amit Kumar","Neha Sharma","Rahul Mishra","Amit Kumar"][i]}</p></div><MoreHorizontal size={18}/></div>)}</div></section>}
function ComingSoon({page}:{page:Page}){return <section className="panel coming-soon"><div className="coming-icon">{page==="Attendance"?<ClipboardCheck size={25}/>:page==="Fees"?<IndianRupee size={25}/>:<BookOpen size={25}/>}</div><h2>{page} module</h2><p>This module is included in the development roadmap. The next build will connect it to the live institute database and role-based workflows.</p><span className="status status-hold">In development</span></section>}
