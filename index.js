const express = require('express');
const cors = require('cors');
const mysql = require('mysql');


const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json()); // Enable JSON parsing

// Database Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: '',
    database: 'goout',
    port: 3306,
   
});



db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log("Connected to MySQL database");
});

// Fetch All Registered Students
app.get("/", (req, res) => {
    const sql = "SELECT student_id FROM student_registration";  // Fixed table name
    db.query(sql, (err, data) => {
        if (err) return res.json({ message: "Error fetching data" });
        return res.json(data);
    });
});

// Student Registration API
app.post("/api/register", async (req, res) => {
    const { student_id, name, email, mobile, password, role } = req.body;

    if (!student_id || !name || !email || !mobile || !password || !role) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password
        const sql = "INSERT INTO student_registration (student_id, name, email, mobile, password, role) VALUES (?, ?, ?, ?, ?, ?)";
        const values = [student_id, name, email, mobile, hashedPassword, role];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("Insert error:", err);
                return res.status(500).json({ message: "Database error" });
            }
            return res.status(201).json({ message: "Registration successful" });
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error" });
    }
});

// Parent Registration API
app.post("/api/register-parent", async (req, res) => {
    const { student_id, parent_name, email, mobile, password } = req.body;

    if (!student_id || !parent_name || !email || !mobile || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const checkSql = "SELECT * FROM parent_registration WHERE student_id = ?";
        db.query(checkSql, [student_id], async (err, result) => {
            if (err) return res.status(500).json({ message: "Database error" });
            if (result.length > 0) return res.status(400).json({ message: "Parent already registered for this student" });

            // Hash the password before inserting
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertSql = `INSERT INTO parent_registration (student_id, parent_name, email, mobile, password) VALUES (?, ?, ?, ?, ?)`;
            const values = [student_id, parent_name, email, mobile, hashedPassword];

            db.query(insertSql, values, (err, result) => {
                if (err) return res.status(500).json({ message: "Database error" });
                return res.status(201).json({ message: "Parent registration successful" });
            });
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/register-lecturer", async (req, res) => {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO lecturer (name, email, mobile, password) VALUES (?, ?, ?, ?)";
        const values = [name, email, mobile, hashedPassword];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("Insert error:", err);
                return res.status(500).json({ message: "Database error" });
            }
            return res.status(201).json({ message: "Lecturer registration successful" });
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error" });
    }
});

// Fetch Student IDs NOT registered by parents
app.get("/api/unregistered-student-ids", (req, res) => {
    const sql = `
        SELECT student_id 
        FROM student_registration 
        WHERE student_id NOT IN (SELECT student_id FROM parent_registration)
    `;

    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ message: "Database error" });
        return res.json(data);
    });
});

// Function to check login for all roles
const checkUser = (email, password, callback) => {
    const tables = [
        { name: "student_registration", role: "student" },
        { name: "parent_registration", role: "parent" },
        { name: "lecturer", role: "lecturer" } 
    ];

    const checkNext = (index) => {
        if (index >= tables.length) {
            return callback(null, null); // User not found in any table
        }

        const table = tables[index];
        const query = `SELECT * FROM ${table.name} WHERE email = ?`;

        db.query(query, [email], async (err, results) => {
            if (err) return callback(err, null);

            if (results.length > 0) {
                const user = results[0];

                console.log("DB Password:", user.password, "Entered Password:", password);

                const passwordMatch = await bcrypt.compare(password, user.password);
                
                if (passwordMatch) {
                    return callback(null, { role: table.role, user });
                }
            }
            checkNext(index + 1); // Check next table
        });
    };

    checkNext(0);
};





// Login API
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    checkUser(email, password, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Server error" });

        if (!result) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        // Ensure the user object contains student_id
        const userData = { 
            role: result.role,
            student_id: result.user.student_id  // Extract student_id
        };

        res.json({ success: true, message: "Login successful", ...userData });
    });
});


// 🟢 Student Submits a Request
app.post("/api/request", (req, res) => {
    const { student_id, reason } = req.body;
    if (!student_id || !reason) {
        return res.status(400).json({ message: "Student ID and reason are required" });
    }
    const sql = "INSERT INTO permission_requests (student_id, reason, status) VALUES (?, ?, 'pending')";
    db.query(sql, [student_id, reason], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.status(201).json({ message: "Request submitted successfully" });
    });
});

// 🟢 Parent Approves (Verify Stage)
app.post("/api/approve-parent", (req, res) => {
    const { request_id } = req.body;
    if (!request_id) {
        return res.status(400).json({ message: "Request ID is required" });
    }
    const sql = "UPDATE permission_requests SET status = 'verify' WHERE id = ? AND status = 'pending'";
    db.query(sql, [request_id], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "Request verified by parent" });
    });
});






app.post("/api/approve-lecturer", (req, res) => {
    const request_id = req.body.request_id;

    if (!request_id) {
        return res.status(400).json({ message: "Missing request ID" });
    }

    // Update request status in MySQL
    const sql = "UPDATE permission_requests SET status = 'success' WHERE id = ?";
    db.query(sql, [request_id], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Request not found" });
        }

        res.json({ message: "Request approved successfully" });
    });
});








// 🟢 Get Student Requests with Date
app.get("/api/requests/student/:student_id", (req, res) => {
    const student_id = req.params.student_id;
    const sql = "SELECT id, reason, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS date FROM permission_requests WHERE student_id = ?";
    db.query(sql, [student_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json(results);
    });
});

// 🟢 Get Pending Requests for Parent
app.get("/api/requests/parent", (req, res) => {
    const sql = "SELECT id, student_id, reason, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS date FROM permission_requests WHERE status = 'pending'";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json(results);
    });
});

// 🟢 Get Verify Requests for Lecturer
app.get("/api/requests/lecturer", (req, res) => {
    const sql = "SELECT id, student_id,reason, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS date FROM permission_requests WHERE status = 'verify'";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json(results);
    });
});




app.get("/api/requests/parent/:student_id", (req, res) => {
    const student_id = req.params.student_id;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required" });
    }

    const sql = `SELECT id, reason, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS date 
                 FROM permission_requests WHERE student_id = ?`;

    db.query(sql, [student_id], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "No requests found for this student" });
        }

        res.json(results);
    });
});













app.listen(3306, () => {
    console.log("Server running on port 8081...");
});
