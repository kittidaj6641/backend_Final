import express from "express";
import pool from "../db/db.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    // 1. เชื่อมต่อ Client
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // เริ่มกระบวนการ

        // --- ตรวจสอบข้อมูลเบื้องต้น ---
        if (!name || !email || !password) {
            return res.status(400).json({ msg: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        }

        // --- ตรวจสอบ Email ซ้ำ ---
        const userExists = await client.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            await client.query('ROLLBACK'); // ยกเลิกถ้าเจอซ้ำ
            return res.status(409).json({ msg: "Email นี้มีการใช้งานแล้ว" });
        }

        // --- แฮชรหัสผ่าน ---
        const hashedPass = await bcrypt.hash(password, 10);

        // --- เพิ่มผู้ใช้ใหม่ ---
        const newUserQuery = `
            INSERT INTO users (name, email, password) 
            VALUES ($1, $2, $3) 
            RETURNING id, name, email
        `;
        const newUserResult = await client.query(newUserQuery, [name, email, hashedPass]);
        
        // (ลบโค้ดส่วนการ Insert อุปกรณ์เริ่มต้นออกแล้ว)

        await client.query('COMMIT'); // ยืนยันการบันทึกข้อมูลลงฐานข้อมูล

        // เปลี่ยนข้อความ Response ให้ถูกต้อง
        res.status(201).json({ 
            msg: "สมัครสมาชิกสำเร็จ", 
            user: newUserResult.rows[0] 
        });

    } catch (err) {
        await client.query('ROLLBACK'); // ถ้าพัง ให้ยกเลิกทั้งหมด
        console.error('User registration error:', err);
        res.status(500).json({ msg: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
    } finally {
        client.release(); // คืน Connection ให้ Pool
    }
});

export default router;
