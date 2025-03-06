const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// 🟢 MongoDB Connection
// mongoose.connect('mongodb://localhost:27017/goout', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// }).then(() => console.log("Connected to MongoDB"))
//   .catch(err => console.error("MongoDB connection error:", err));







  mongoose.connect('mongodb+srv://eppakayalanaresh08:ZCAAIRx5uDWAz1Oe@cluster0.jmgg6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB Atlas"))
.catch(err => console.error("MongoDB connection error:", err));







// 🟢 Define MongoDB Schemas
const studentSchema = new mongoose.Schema({
    student_id: String,
    name: String,
    email: String,
    mobile: String,
    password: String,
    role: String,
});

const parentSchema = new mongoose.Schema({
    student_id: String,
    parent_name: String,
    email: String,
    mobile: String,
    password: String,
    role: String,
});

const lecturerSchema = new mongoose.Schema({
    name: String,
    email: String,
    mobile: String,
    password: String,
    role: String,
});

const requestSchema = new mongoose.Schema({
    student_id: String,
    reason: String,
    status: { type: String, default: 'pending' },
    created_at: { type: Date, default: Date.now }
});

// 🟢 MongoDB Models
const Student = mongoose.model('Student', studentSchema);
const Parent = mongoose.model('Parent', parentSchema);
const Lecturer = mongoose.model('Lecturer', lecturerSchema);
const Request = mongoose.model('Request', requestSchema);

// 🟢 Fetch All Registered Students
app.get("/", async (req, res) => {
    try {
        const students = await Student.find({}, 'student_id');
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: "Error fetching data" });
    }
});

// 🟢 Student Registration
app.post("/api/register", async (req, res) => {
    const { student_id, name, email, mobile, password, role } = req.body;

    if (!student_id || !name || !email || !mobile || !password || !role) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newStudent = new Student({ student_id, name, email, mobile, password: hashedPassword, role });
        await newStudent.save();
        res.status(201).json({ message: "Registration successful" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});

// 🟢 Parent Registration
app.post("/api/register-parent", async (req, res) => {
    const { student_id, parent_name, email, mobile, password } = req.body;

    if (!student_id || !parent_name || !email || !mobile || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const existingParent = await Parent.findOne({ student_id });
        if (existingParent) {
            return res.status(400).json({ message: "Parent already registered for this student" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newParent = new Parent({ student_id, parent_name, email, mobile, password: hashedPassword });
        await newParent.save();
        res.status(201).json({ message: "Parent registration successful" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});

// 🟢 Lecturer Registration
app.post("/api/register-lecturer", async (req, res) => {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newLecturer = new Lecturer({ name, email, mobile, password: hashedPassword });
        await newLecturer.save();
        res.status(201).json({ message: "Lecturer registration successful" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});


app.get("/api/unregistered-student-ids", async (req, res) => {
    try {
        // Fetch all student IDs from the student_registration collection
        // const students = await StudentRegistration.find({}, "student_id");

        // // Fetch all student IDs from the parent_registration collection
        // const registeredParents = await ParentRegistration.find({}, "student_id");


        const students = await Student.find({}, "student_id"); 
const registeredParents = await Parent.find({}, "student_id");


        // Convert the parent-registered IDs to a Set for fast lookup
        const registeredIds = new Set(registeredParents.map(p => p.student_id));

        // Filter students to get only unregistered ones
        const unregisteredStudents = students.filter(s => !registeredIds.has(s.student_id));

        res.json(unregisteredStudents);
    } catch (err) {
        res.status(500).json({ message: "Database error", error: err.message });
    }
});





// // 🟢 Login API
// app.post("/api/login", async (req, res) => {
//     const { email, password } = req.body;

//     try {
//         let user = await Student.findOne({ email }) || 
//                    await Parent.findOne({ email }) || 
//                    await Lecturer.findOne({ email });

//         if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });

//         const passwordMatch = await bcrypt.compare(password, user.password);
//         if (!passwordMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

//         res.json({ success: true, message: "Login successful", role: user.role, student_id: user.student_id || null });
//     } catch (err) {
//         res.status(500).json({ success: false, message: "Server error" });
//     }
// });



const checkUser = async (email, password) => {
    const collections = [
        { model: Student, role: "student" },
        { model: Parent, role: "parent" },
        { model: Lecturer, role: "lecturer" }
    ];

    for (let { model, role } of collections) {
        const user = await model.findOne({ email });

        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                console.log(`User found in ${model.collection.name} with role: ${role}`);
                return { role, user };
            }
        }
    }

    return null; // User not found
};



app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await checkUser(email, password);

        if (!result) {
            console.log("Login failed: Invalid email or password");
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        console.log("Login successful. Role:", result.role);

        // Send response with role and student_id if available
        res.json({
            success: true,
            message: "Login successful",
            role: result.role,
            student_id: result.user.student_id || null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});



























// 🟢 Student Submits a Request
app.post("/api/request", async (req, res) => {
    const { student_id, reason } = req.body;

    if (!student_id || !reason) {
        return res.status(400).json({ message: "Student ID and reason are required" });
    }

    try {
        const newRequest = new Request({ student_id, reason });
        await newRequest.save();
        res.status(201).json({ message: "Request submitted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});


// 🟢 Get Requests for a Parent Based on Student ID
app.get("/api/requests/parent/:student_id", async (req, res) => {
    const { student_id } = req.params;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required" });
    }

    try {
        // Fetch requests for the given student_id
        const requests = await Request.find({ student_id }, "id reason status created_at");

        if (requests.length === 0) {
            return res.status(404).json({ message: "No requests found for this student" });
        }

        // Format the date before sending the response
        const formattedRequests = requests.map(req => ({
            id: req._id,  // MongoDB uses _id instead of id
            reason: req.reason,
            status: req.status,
            date: req.created_at.toISOString().slice(0, 16).replace("T", " ") // Format as 'YYYY-MM-DD HH:mm'
        }));

        res.json(formattedRequests);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ message: "Database error" });
    }
});









// 🟢 Parent Approves Request
app.post("/api/approve-parent", async (req, res) => {
    const { request_id } = req.body;

    if (!request_id) return res.status(400).json({ message: "Request ID is required" });

    try {
        const request = await Request.findByIdAndUpdate(request_id, { status: 'verify' });
        if (!request) return res.status(404).json({ message: "Request not found" });

        res.json({ message: "Request verified by parent" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});








app.post("/api/accept-request-parent", async (req, res) => {
    const { request_id } = req.body;

    if (!request_id) {
        return res.status(400).json({ message: "Request ID is required" });
    }

    try {
        const request = await Request.findById(request_id);

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (request.status !== "pending") {
            return res.status(400).json({ message: "Request is already processed" });
        }

        request.status = "verify";
        await request.save();

        res.json({ message: "Request accepted by parent" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});












// 🟢 Lecturer Approves Request
app.post("/api/approve-lecturer", async (req, res) => {
    const { request_id } = req.body;

    if (!request_id) return res.status(400).json({ message: "Request ID is required" });

    try {
        const request = await Request.findByIdAndUpdate(request_id, { status: 'success' });
        if (!request) return res.status(404).json({ message: "Request not found" });

        res.json({ message: "Request approved successfully" });
    } catch (err) {
        res.status(500).json({ message: "Database error" });
    }
});

// 🟢 Start the Server
app.listen(8081, () => {
    console.log("Server running on port 8081...");
});
