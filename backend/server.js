import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === "http://localhost:5173" || origin.endsWith(".vercel.app")) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json());

const { Schema, model } = mongoose;
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true, select: false },
  college: { type: String, default: "" }, bio: { type: String, default: "" },
  skills: { type: [String], default: [] }, github_url: { type: String, default: "" }
}, { timestamps: true });
const projectSchema = new Schema({
  owner_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true }, description: { type: String, required: true },
  category: { type: String, default: "Other" }, required_skills: { type: [String], default: [] }
}, { timestamps: true });
const joinRequestSchema = new Schema({
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, default: "" }, status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
}, { timestamps: true });
joinRequestSchema.index({ project_id: 1, user_id: 1 }, { unique: true });
const bookmarkSchema = new Schema({
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
bookmarkSchema.index({ project_id: 1, user_id: 1 }, { unique: true });
const User = model("User", userSchema);
const Project = model("Project", projectSchema);
const JoinRequest = model("JoinRequest", joinRequestSchema);
const Bookmark = model("Bookmark", bookmarkSchema);

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const safeUser = user => ({ id: String(user._id), name: user.name, email: user.email, college: user.college, bio: user.bio, skills: user.skills, github_url: user.github_url });
const tokenFor = user => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "7d" });
const validId = id => mongoose.isValidObjectId(id);

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please log in first." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Account not found." });
    req.user = safeUser(user); next();
  } catch { return res.status(401).json({ error: "Session expired. Please log in again." }); }
}

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "CampusConnect API" }));
app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const { name, email, password, college = "" } = req.body;
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: "Name, email and password are required." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const hash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password_hash: hash, college: college.trim() });
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ error: "This email is already registered." }); throw e; }
}));
app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() }).select("+password_hash");
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password_hash))) return res.status(401).json({ error: "Incorrect email or password." });
  res.json({ token: tokenFor(user), user: safeUser(user) });
}));
app.get("/api/me", auth, (req, res) => res.json({ user: req.user }));
app.put("/api/me", auth, asyncRoute(async (req, res) => {
  const { name, college = "", bio = "", skills = [], github_url = "" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required." });
  const cleanSkills = Array.isArray(skills) ? skills.map(s => String(s).trim()).filter(Boolean).slice(0, 30) : [];
  const user = await User.findByIdAndUpdate(req.user.id, { name: name.trim(), college, bio, skills: cleanSkills, github_url }, { new: true, runValidators: true });
  res.json({ user: safeUser(user) });
}));
app.get("/api/users", auth, asyncRoute(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const users = await User.find({ _id: { $ne: req.user.id }, $or: [{ name: regex }, { college: regex }, { skills: regex }] }).limit(50).sort({ name: 1 });
  res.json({ users: users.map(safeUser) });
}));
app.get("/api/projects", auth, asyncRoute(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const projects = await Project.find({ $or: [{ title: regex }, { description: regex }, { category: regex }, { required_skills: regex }] }).sort({ createdAt: -1 }).lean();
  const ids = projects.map(p => p._id);
  const [owners, bookmarks, requests] = await Promise.all([
    User.find({ _id: { $in: projects.map(p => p.owner_id) } }).select("name college").lean(),
    Bookmark.find({ user_id: req.user.id, project_id: { $in: ids } }).select("project_id").lean(),
    JoinRequest.find({ user_id: req.user.id, project_id: { $in: ids } }).select("project_id").lean()
  ]);
  const ownerMap = new Map(owners.map(u => [String(u._id), u]));
  const bookmarked = new Set(bookmarks.map(b => String(b.project_id)));
  const requested = new Set(requests.map(r => String(r.project_id)));
  res.json({ projects: projects.map(p => ({ ...p, id: String(p._id), owner_id: String(p.owner_id), owner_name: ownerMap.get(String(p.owner_id))?.name || "Student", owner_college: ownerMap.get(String(p.owner_id))?.college || "", bookmarked: bookmarked.has(String(p._id)), requested: requested.has(String(p._id)), created_at: p.createdAt })) });
}));
app.post("/api/projects", auth, asyncRoute(async (req, res) => {
  const { title, description, category = "Other", required_skills = [] } = req.body;
  if (!title?.trim() || !description?.trim()) return res.status(400).json({ error: "Project title and description are required." });
  const skills = Array.isArray(required_skills) ? required_skills.map(s => String(s).trim()).filter(Boolean) : [];
  const p = await Project.create({ owner_id: req.user.id, title: title.trim(), description: description.trim(), category, required_skills: skills });
  res.status(201).json({ project: { ...p.toObject(), id: String(p._id), owner_id: String(p.owner_id), created_at: p.createdAt } });
}));
app.delete("/api/projects/:id", auth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Project not found or you are not its owner." });
  const p = await Project.findOneAndDelete({ _id: req.params.id, owner_id: req.user.id });
  if (!p) return res.status(404).json({ error: "Project not found or you are not its owner." });
  await Promise.all([JoinRequest.deleteMany({ project_id: p._id }), Bookmark.deleteMany({ project_id: p._id })]);
  res.json({ message: "Project deleted." });
}));
app.post("/api/projects/:id/join", auth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Project not found." });
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (String(project.owner_id) === req.user.id) return res.status(400).json({ error: "You already own this project." });
  try { const jr = await JoinRequest.create({ project_id: project._id, user_id: req.user.id, message: req.body.message || "" }); res.status(201).json({ request: { ...jr.toObject(), id: String(jr._id) } }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: "You have already requested to join this project." }); throw e; }
}));
app.get("/api/requests/received", auth, asyncRoute(async (req, res) => {
  const owned = await Project.find({ owner_id: req.user.id }).select("_id title").lean();
  const projectMap = new Map(owned.map(p => [String(p._id), p]));
  const requests = await JoinRequest.find({ project_id: { $in: owned.map(p => p._id) } }).sort({ createdAt: -1 }).lean();
  const users = await User.find({ _id: { $in: requests.map(r => r.user_id) } }).select("name email skills").lean();
  const userMap = new Map(users.map(u => [String(u._id), u]));
  res.json({ requests: requests.map(r => ({ ...r, id: String(r._id), project_title: projectMap.get(String(r.project_id))?.title || "", student_name: userMap.get(String(r.user_id))?.name || "Student", student_email: userMap.get(String(r.user_id))?.email || "", skills: userMap.get(String(r.user_id))?.skills || [], created_at: r.createdAt })) });
}));
app.patch("/api/requests/:id", auth, asyncRoute(async (req, res) => {
  const { status } = req.body;
  if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be accepted or rejected." });
  if (!validId(req.params.id)) return res.status(404).json({ error: "Pending request not found." });
  const owned = await Project.find({ owner_id: req.user.id }).select("_id").lean();
  const jr = await JoinRequest.findOneAndUpdate({ _id: req.params.id, project_id: { $in: owned.map(p => p._id) }, status: "pending" }, { status }, { new: true });
  if (!jr) return res.status(404).json({ error: "Pending request not found." });
  res.json({ request: { ...jr.toObject(), id: String(jr._id) } });
}));
app.get("/api/bookmarks", auth, asyncRoute(async (req, res) => {
  const saved = await Bookmark.find({ user_id: req.user.id }).sort({ createdAt: -1 }).lean();
  const projects = await Project.find({ _id: { $in: saved.map(b => b.project_id) } }).lean();
  const owners = await User.find({ _id: { $in: projects.map(p => p.owner_id) } }).select("name").lean();
  const ownerMap = new Map(owners.map(u => [String(u._id), u.name]));
  res.json({ projects: projects.map(p => ({ ...p, id: String(p._id), owner_id: String(p.owner_id), owner_name: ownerMap.get(String(p.owner_id)) || "Student", bookmarked: true, created_at: p.createdAt })) });
}));
app.post("/api/projects/:id/bookmark", auth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id) || !(await Project.exists({ _id: req.params.id }))) return res.status(404).json({ error: "Project not found." });
  const existing = await Bookmark.findOne({ user_id: req.user.id, project_id: req.params.id });
  if (existing) { await existing.deleteOne(); return res.json({ bookmarked: false }); }
  try { await Bookmark.create({ user_id: req.user.id, project_id: req.params.id }); } catch (e) { if (e.code !== 11000) throw e; }
  res.json({ bookmarked: true });
}));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Something went wrong on the server. Check backend logs." }); });

const port = process.env.PORT || 5000;
if (!process.env.MONGODB_URI) { console.error("MONGODB_URI is missing. Add it to backend/.env"); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error("JWT_SECRET is missing. Add it to backend/.env"); process.exit(1); }
try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  app.listen(port, () => console.log(`CampusConnect API running on port ${port}`));
} catch (error) { console.error("MongoDB connection failed:", error.message); process.exit(1); }
