import express from "express";
import pool from "../db/db.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // 1. ตรวจสอบว่าข้อมูลครบถ้วน
        if (!name || !email || !password) {
            return res.status(400).json({ msg: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        }

        // 2. ตรวจสอบว่า email ซ้ำหรือไม่
        const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ msg: "Email นี้มีการใช้งานแล้ว" });
        }

        // 3. แฮชรหัสผ่าน
        const hashedPass = await bcrypt.hash(password, 10);

        // 4. เพิ่มผู้ใช้ใหม่ (แก้ตรงนี้: ให้ RETURNING id กลับมาด้วย)
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
            [name, email, hashedPass]
        );

        // ดึง ID ของ User ใหม่ที่เพิ่งสร้าง
        const newUserId = newUser.rows[0].id;

        // 5. เพิ่มอุปกรณ์เริ่มต้น (ESP32_001) ให้ User คนนี้ทันที
        // สมมติว่าตารางชื่อ devices และมีฟิลด์ user_id, device_id, device_name, location
        await pool.query(
            "INSERT INTO devices (user_id, device_id, device_name, location) VALUES ($1, $2, $3, $4)",
            [newUserId, 'ESP32_001', 'อุปกรณ์เริ่มต้น', 'ฟาร์มของฉัน']
        );

        res.status(201).json({ 
            msg: "สมัครสมาชิกสำเร็จ และเพิ่มอุปกรณ์เริ่มต้นเรียบร้อยแล้ว", 
            user: newUser.rows[0] 
        });

    } catch (err) {
        console.error('User registration error:', err);
        res.status(500).json({ msg: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
    }
});


export default router;
