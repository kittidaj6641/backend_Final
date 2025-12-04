import express from "express";
import pool from "../db/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

// ✅ 1. Import verifyToken ตัวเดียวพอ (ลบ import auth ทิ้งไปเลยครับ)
import { verifyToken } from "../middleware/auth.js";

dotenv.config();
const router = express.Router();

const genToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) return res.status(400).json({ msg: "ไม่พบ Email" });
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) return res.status(400).json({ msg: "Password ไม่ถูกต้อง" });
        const token = genToken(user.rows[0]);
        await pool.query("INSERT INTO login_logs (email, login_time, status) VALUES ($1, NOW(), $2)", [email, "online"]);
        res.json({ msg: "เข้าสู่ระบบสำเร็จ", token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});

// Logout
router.post("/logout", verifyToken, async (req, res) => {
    const email = req.user.email;
    try {
        await pool.query(
            "UPDATE login_logs SET status = $1 WHERE email = $2 AND id = (SELECT id FROM login_logs WHERE email = $2 ORDER BY login_time DESC LIMIT 1)",
            ["offline", email]
        );
        res.json({ msg: "ออกจากระบบสำเร็จ" });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});

// แสดงโปรไฟล์ member
router.get("/", verifyToken, async (req, res) => {
    const userid = req.user.id;
    try {
        const user = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = $1", [userid]);
        res.json(user.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    }
});

router.post("/", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) return res.json({ msg: "Email นี้มีการใช้งานแล้ว" });
        const hashedPass = await bcrypt.hash(password, 10);
        const newUser = await pool.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING name, email", [name, email, hashedPass]);
        res.status(201).json({ msg: "สมัครสมาชิกสำเร็จ", user: newUser.rows[0] });
    } catch (err) {
        console.error('User registration error:', err);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// ดึง login logs
router.get("/login-logs", verifyToken, async (req, res) => {
    try {
        const logs = await pool.query("SELECT email, login_time, status FROM login_logs WHERE email = $1 ORDER BY login_time DESC", [req.user.email]);
        res.json(logs.rows);
    } catch (err) {
        console.error('Login logs error:', err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});

// ดึงข้อมูล water_quality 8 ตัวล่าสุด (Filter ตาม Device ID)
router.get("/water-quality", verifyToken, async (req, res) => {
    const { deviceId } = req.query;

    if (!deviceId) {
        return res.status(400).json({ msg: "Missing deviceId parameter" });
    }

    try {
        // ตรวจสอบว่า device นี้เป็นของ user นี้จริงหรือไม่
        const deviceCheck = await pool.query("SELECT * FROM devices WHERE device_id = $1 AND user_id = $2", [deviceId, req.user.id]);
        if (deviceCheck.rows.length === 0) {
            return res.status(403).json({ msg: "Unauthorized access to this device" });
        }

        const result = await pool.query("SELECT * FROM water_quality WHERE device_id = $1 ORDER BY recorded_at DESC LIMIT 8", [deviceId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Water quality fetch error:', err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});

// รับข้อมูลจากเซ็นเซอร์และบันทึกใน water_quality
router.post('/water-quality-sensor', async (req, res) => {
    const { dissolved_oxygen, ph, temperature, turbidity, device_id } = req.body;

    if (!dissolved_oxygen || !ph || !temperature || !turbidity || !device_id) {
        return res.status(400).json({ msg: "Missing required fields (including device_id)" });
    }

    try {
        // ตรวจสอบว่ามี device_id นี้ในระบบหรือไม่ (Optional: ถ้าอยากให้ส่งได้เฉพาะ device ที่ลงทะเบียนแล้ว)
        const deviceExists = await pool.query("SELECT * FROM devices WHERE device_id = $1", [device_id]);
        if (deviceExists.rows.length === 0) {
            return res.status(404).json({ msg: "Device ID not found in system" });
        }

        const result = await pool.query(
            "INSERT INTO water_quality (dissolved_oxygen, ph, temperature, turbidity, device_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [dissolved_oxygen, ph, temperature, turbidity, device_id]
        );
        console.log('Water quality data saved at', new Date().toISOString(), ':', result.rows[0]);
        res.status(201).json({ msg: "Data saved successfully", data: result.rows[0] });
    } catch (err) {
        console.error('Water quality sensor error at', new Date().toISOString(), ':', err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});



// GET /member/devices - ดึงข้อมูลอุปกรณ์ทั้งหมด ของ User คนนั้นๆ
router.get('/devices', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query('SELECT * FROM devices WHERE user_id = $1 ORDER BY added_at DESC', [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching devices' });
    }
});

router.post("/devices/add", verifyToken, async (req, res) => {
    const { deviceName, deviceId, location } = req.body;
    const userId = req.user.id;

    if (!deviceName || !deviceId) {
        return res.status(400).json({ msg: "กรุณากรอกชื่อและรหัสอุปกรณ์" });
    }

    try {
        // --- ส่วนที่ 1: จัดการตาราง Master (devices) ---
        // เช็คว่า Device ID นี้เคยถูกลงทะเบียนในระบบโลกหรือยัง
        const deviceCheck = await pool.query("SELECT * FROM devices WHERE device_id = $1", [deviceId]);
        
        if (deviceCheck.rows.length === 0) {
            // ถ้ายังไม่มีในระบบเลย ให้สร้างใหม่ (เป็น Master Data)
            // หมายเหตุ: ตรงนี้ถ้าตาราง devices เดิมของคุณมี column user_id ที่บังคับใส่ (NOT NULL) 
            // คุณอาจจะต้องแก้ SQL นี้ให้ใส่ user_id ของคนแรก หรือแก้ตารางให้ user_id เป็น NULL ได้
            await pool.query(
                "INSERT INTO devices (device_id, device_name, location) VALUES ($1, $2, $3)",
                [deviceId, deviceName, location]
            );
        }

        // --- ส่วนที่ 2: จัดการสิทธิ์เจ้าของ (user_devices) ---
        // เช็คว่า User คนนี้ เคยเพิ่ม Device นี้ไปแล้วหรือยัง? (ป้องกันการเพิ่มซ้ำของคนเดิม)
        const userDeviceCheck = await pool.query(
            "SELECT * FROM user_devices WHERE user_id = $1 AND device_id = $2",
            [userId, deviceId]
        );

        if (userDeviceCheck.rows.length > 0) {
            return res.status(400).json({ msg: "คุณได้เพิ่มอุปกรณ์นี้ไปแล้ว" });
        }

        // เพิ่มสิทธิ์ความเป็นเจ้าของลงในตารางใหม่
        // ข้อมูล deviceName และ location ตรงนี้จะเป็นของ User คนนั้นๆ เอง
        const newDeviceLink = await pool.query(
            "INSERT INTO user_devices (user_id, device_id, device_name, location) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, deviceId, deviceName, location]
        );

        res.status(201).json({ msg: "เพิ่มอุปกรณ์สำเร็จ", device: newDeviceLink.rows[0] });

    } catch (err) {
        console.error("Error adding device:", err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});
export default router;
