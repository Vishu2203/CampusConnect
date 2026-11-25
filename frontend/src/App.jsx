import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const getToken = () => localStorage.getItem("cc_token");
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
const splitSkills = value => value.split(",").map(s => s.trim()).filter(Boolean);

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name:"", email:"", password:"", college:"" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = e => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const data = await api(`/auth/${mode}`, { method:"POST", body:JSON.stringify(form) });
      localStorage.setItem("cc_token", data.token); onAuth(data.user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-shell"><div className="auth-visual">
    <div className="brand light"><span className="brand-mark">C</span> CampusConnect</div>
    <div><p className="eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</p><h1>Big ideas need<br/><em>great teams.</em></h1>
    <p className="muted-light">Meet talented students, discover projects and turn your next idea into something real.</p></div>
    <div className="visual-foot">Connect · Collaborate · Create</div>
  </div><div className="auth-form-wrap"><form className="auth-form" onSubmit={submit}>
    <p className="eyebrow">WELCOME TO CAMPUSCONNECT</p><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
    <p className="subtle">{mode === "login" ? "Sign in to continue building." : "Join your campus community today."}</p>
    {mode === "register" && <><label>Full name<input name="name" placeholder="Your name" value={form.name} onChange={change} required/></label><label>College<input name="college" placeholder="College or university" value={form.college} onChange={change}/></label></>}
    <label>Email address<input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={change} required/></label>
    <label>Password<input type="password" name="password" placeholder="At least 8 characters" value={form.password} onChange={change} required minLength="8"/></label>
    {error && <div className="error">{error}</div>}<button className="primary full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"} <span>→</span></button>
    <p className="switch-auth">{mode === "login" ? "New to CampusConnect?" : "Already have an account?"} <button type="button" onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}}>{mode==="login"?"Create an account":"Sign in"}</button></p>
  </form></div></div>;
}

function App() {
  const [user,setUser] = useState(null), [tab,setTab] = useState("Discover");
  const [projects,setProjects] = useState([]), [requests,setRequests] = useState([]), [bookmarks,setBookmarks] = useState([]);
  const [query,setQuery] = useState(""), [notice,setNotice] = useState(""), [loading,setLoading] = useState(false);
  const [showCreate,setShowCreate] = useState(false);
  const [profile,setProfile] = useState({ name:"",college:"",bio:"",skills:"",github_url:"" });
  const [newProject,setNewProject] = useState({ title:"",description:"",category:"Web Development",required_skills:"" });
  const [joinMessage,setJoinMessage] = useState({});

  useEffect(()=>{ if(getToken()) api("/me").then(d=>setUser(d.user)).catch(()=>localStorage.removeItem("cc_token")); },[]);
  useEffect(()=>{ if(user){setProfile({name:user.name||"",college:user.college||"",bio:user.bio||"",skills:(user.skills||[]).join(", "),github_url:user.github_url||""}); loadAll();} },[user]);
  useEffect(()=>{ if(user) loadProjects(); },[query]);
  async function loadProjects(){ try{setLoading(true);const d=await api(`/projects?q=${encodeURIComponent(query)}`);setProjects(d.projects);}catch(e){flash(e.message);}finally{setLoading(false);} }
  async function loadAll(){ await Promise.all([loadProjects(),loadRequests(),loadBookmarks()]); }
  async function loadRequests(){try{const d=await api("/requests/received");setRequests(d.requests);}catch{}}
  async function loadBookmarks(){try{const d=await api("/bookmarks");setBookmarks(d.projects);}catch{}}
  function flash(msg){setNotice(msg);setTimeout(()=>setNotice(""),3500);}
  function logout(){localStorage.removeItem("cc_token");setUser(null);setTab("Discover");}
  async function createProject(e){e.preventDefault();try{await api("/projects",{method:"POST",body:JSON.stringify({...newProject,required_skills:splitSkills(newProject.required_skills)})});setNewProject({title:"",description:"",category:"Web Development",required_skills:""});setShowCreate(false);loadProjects();flash("Your project is live!");}catch(e){flash(e.message);}}
  async function join(id){try{await api(`/projects/${id}/join`,{method:"POST",body:JSON.stringify({message:joinMessage[id]||""})});flash("Join request sent!");loadProjects();}catch(e){flash(e.message);}}
  async function bookmark(id){try{await api(`/projects/${id}/bookmark`,{method:"POST"});loadProjects();loadBookmarks();}catch(e){flash(e.message);}}
  async function decide(id,status){try{await api(`/requests/${id}`,{method:"PATCH",body:JSON.stringify({status})});loadRequests();flash(`Request ${status}.`);}catch(e){flash(e.message);}}
  async function saveProfile(e){e.preventDefault();try{const d=await api("/me",{method:"PUT",body:JSON.stringify({...profile,skills:splitSkills(profile.skills)})});setUser(d.user);flash("Profile updated.");}catch(e){flash(e.message);}}
  async function removeProject(id){if(!confirm("Delete this project?"))return;try{await api(`/projects/${id}`,{method:"DELETE"});loadProjects();flash("Project deleted.");}catch(e){flash(e.message);}}

  if(!user) return <Auth onAuth={setUser}/>;
  const myProjects=projects.filter(p=>p.owner_id===user.id);
  const menu=["Discover","My Projects","Requests","Bookmarks","My Profile"];
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">C</span> CampusConnect</div>
      <div className="side-label">WORKSPACE</div><nav>{menu.map((item,i)=><button key={item} className={tab===item?"nav-item active":"nav-item"} onClick={()=>setTab(item)}><span className="nav-icon">{["⌕","▣","↗","☆","◉"][i]}</span>{item}{item==="Requests"&&requests.filter(r=>r.status==="pending").length>0&&<b className="badge">{requests.filter(r=>r.status==="pending").length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="mini-avatar">{user.name?.[0]?.toUpperCase()}</div><div className="user-mini"><strong>{user.name}</strong><small>{user.college||"Student account"}</small></div><button className="logout" onClick={logout} title="Sign out">↗</button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><span className="crumb">Workspace</span><span className="slash"> / </span><strong>{tab}</strong></div><div className="top-right"><span className="online-dot"></span> Student community <div className="top-avatar">{user.name?.[0]?.toUpperCase()}</div></div></header>
    <div className="content">
      {tab==="Discover"&&<><section className="welcome-row"><div><p className="eyebrow">THE STUDENT NETWORK</p><h1>Find your next <em>collaboration.</em></h1><p className="subtle">Discover ideas, meet teammates and build something meaningful.</p></div><button className="primary" onClick={()=>setShowCreate(true)}>＋ Create a project</button></section>
        <section className="stats"><div className="stat-card"><span>PROJECTS FOUND</span><strong>{projects.length}</strong><small>Across the community</small></div><div className="stat-card"><span>MY PROJECTS</span><strong>{myProjects.length}</strong><small>Ideas you're leading</small></div><div className="stat-card"><span>JOIN REQUESTS</span><strong>{requests.filter(r=>r.status==="pending").length}</strong><small>Waiting for your review</small></div></section>
        <div className="section-heading"><div><h2>Explore projects</h2><p>Find a project that matches your interests.</p></div><div className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects or skills..."/></div></div>
        {showCreate&&<form className="panel create-form" onSubmit={createProject}><div className="form-title"><div><h3>Create a project</h3><p>Tell the community what you're building.</p></div><button type="button" className="icon-button" onClick={()=>setShowCreate(false)}>×</button></div>
          <label>Project title<input required value={newProject.title} onChange={e=>setNewProject({...newProject,title:e.target.value})} placeholder="e.g. AI-powered study planner"/></label>
          <label>Description<textarea required rows="3" value={newProject.description} onChange={e=>setNewProject({...newProject,description:e.target.value})} placeholder="What problem does it solve? What do you want to build?"/></label>
          <div className="two-col"><label>Category<select value={newProject.category} onChange={e=>setNewProject({...newProject,category:e.target.value})}>{["Web Development","AI / Machine Learning","App Development","Cybersecurity","Data Science","Other"].map(x=><option>{x}</option>)}</select></label><label>Required skills<input value={newProject.required_skills} onChange={e=>setNewProject({...newProject,required_skills:e.target.value})} placeholder="React, Python, UI/UX"/></label></div>
          <button className="primary">Publish project →</button></form>}
        {loading?<p className="empty">Loading projects...</p>:<div className="project-grid">{projects.map(p=><ProjectCard key={p.id} p={p} user={user} onJoin={join} onBookmark={bookmark} onDelete={removeProject} message={joinMessage[p.id]||""} setMessage={v=>setJoinMessage({...joinMessage,[p.id]:v})}/>)}</div>}
        {!projects.length&&!loading&&<div className="empty panel">No projects found yet. Be the first to share an idea!</div>}
      </>}
      {tab==="My Projects"&&<><PageTitle title="My projects" text="Manage the ideas you're leading." action={<button className="primary" onClick={()=>{setTab("Discover");setShowCreate(true);}}>＋ New project</button>}/><div className="project-grid">{myProjects.map(p=><ProjectCard key={p.id} p={p} user={user} onJoin={join} onBookmark={bookmark} onDelete={removeProject}/>)}</div>{!myProjects.length&&<div className="empty panel">You haven't created a project yet. Go to Discover to publish your first idea.</div>}</>}
      {tab==="Requests"&&<><PageTitle title="Join requests" text="Review students who want to join your projects."/><div className="request-list">{requests.map(r=><div className="panel request-card" key={r.id}><div className="mini-avatar">{r.student_name?.[0]}</div><div className="request-info"><strong>{r.student_name}</strong><span>{r.student_email} · wants to join <b>{r.project_title}</b></span><p>{r.message||"No message added."}</p><div className="tags">{(r.skills||[]).map(s=><span>{s}</span>)}</div></div><div className="request-actions">{r.status==="pending"?<><button className="primary small" onClick={()=>decide(r.id,"accepted")}>Accept</button><button className="secondary small" onClick={()=>decide(r.id,"rejected")}>Decline</button></>:<span className={`status ${r.status}`}>{r.status}</span>}</div></div>)}</div>{!requests.length&&<div className="empty panel">No requests yet. When students ask to join your projects, they'll appear here.</div>}</>}
      {tab==="Bookmarks"&&<><PageTitle title="Saved projects" text="Ideas you've bookmarked to revisit later."/><div className="project-grid">{bookmarks.map(p=><ProjectCard key={p.id} p={p} user={user} onJoin={join} onBookmark={bookmark}/>)}</div>{!bookmarks.length&&<div className="empty panel">Your saved projects will appear here.</div>}</>}
      {tab==="My Profile"&&<><PageTitle title="Your profile" text="Help other students understand what you can bring to a team."/><form className="panel profile-form" onSubmit={saveProfile}><div className="profile-head"><div className="big-avatar">{user.name?.[0]?.toUpperCase()}</div><div><h3>{user.name}</h3><p>{user.email}</p></div></div><div className="two-col"><label>Full name<input required value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>College<input value={profile.college} onChange={e=>setProfile({...profile,college:e.target.value})} placeholder="Your college"/></label></div><label>About you<textarea rows="4" value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})} placeholder="Write a short introduction..."/></label><label>Your skills <small>(separate with commas)</small><input value={profile.skills} onChange={e=>setProfile({...profile,skills:e.target.value})} placeholder="Java, React, Python, UI/UX"/></label><label>GitHub profile<input value={profile.github_url} onChange={e=>setProfile({...profile,github_url:e.target.value})} placeholder="https://github.com/username"/></label><button className="primary">Save profile →</button></form></>}
    </div></main>{notice&&<div className="toast">{notice}</div>}
  </div>;
}

function PageTitle({title,text,action}){return <section className="page-title"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>{title}</h1><p className="subtle">{text}</p></div>{action}</section>}
function ProjectCard({p,user,onJoin,onBookmark,onDelete,message,setMessage}) {
  const mine=p.owner_id===user.id;
  return <article className="project-card"><div className="card-top"><span className="category">{p.category||"Project"}</span><button className={`bookmark ${p.bookmarked?"saved":""}`} onClick={()=>onBookmark(p.id)} title="Save project">{p.bookmarked?"★":"☆"}</button></div>
    <h3>{p.title}</h3><p className="project-desc">{p.description}</p><div className="tags">{(p.required_skills||[]).map(s=><span key={s}>{s}</span>)}</div>
    <div className="card-footer"><div className="owner-avatar">{p.owner_name?.[0]||user.name?.[0]}</div><div className="owner"><strong>{mine?"You":p.owner_name||"Student"}</strong><small>{p.owner_college||"Campus member"}</small></div><span className="project-date">{new Date(p.created_at).toLocaleDateString()}</span></div>
    {!mine&&!p.requested&&<div className="join-row"><input value={message||""} onChange={e=>setMessage?.(e.target.value)} placeholder="Optional note to owner"/><button className="primary small" onClick={()=>onJoin(p.id)}>Request to join</button></div>}
    {!mine&&p.requested&&<div className="requested-label">✓ Request already sent</div>}
    {mine&&<button className="delete-link" onClick={()=>onDelete(p.id)}>Delete project</button>}
  </article>;
}
export default App;
