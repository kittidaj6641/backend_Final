import express from "express";
import pool from "../db/db.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    // 1. เชื่อมต่อ Client เพื่อเริ่ม Transaction (สำคัญมากสำหรับการบันทึก 2 ตารางพร้อมกัน)
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // เริ่มกระบวนการ

        // --- ตรวจสอบข้อมูลเบื้องต้น ---
        if (!name || !email || !password) {
            return res.status(400).json({ msg: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        }

        // --- ตรวจสอบ Email ซ้ำ ---
        // ใช้ client.query แทน pool.query ภายใน Transaction
        const userExists = await client.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            await client.query('ROLLBACK'); // ยกเลิกถ้าเจอซ้ำ
            return res.status(409).json({ msg: "Email นี้มีการใช้งานแล้ว" });
        }

        // --- แฮชรหัสผ่าน ---
        const hashedPass = await bcrypt.hash(password, 10);

        // --- เพิ่มผู้ใช้ใหม่ ---
        // *สำคัญ* ต้องใส่ RETURNING id เพื่อเอา id ไปใช้ต่อ
        const newUserQuery = `
            INSERT INTO users (name, email, password) 
            VALUES ($1, $2, $3) 
            RETURNING id, name, email
        `;
        const newUserResult = await client.query(newUserQuery, [name, email, hashedPass]);
        
        const newUserId = newUserResult.rows[0].id; // ได้ ID มาแล้ว

        // --- เพิ่มอุปกรณ์เริ่มต้น (ESP32_001) ให้ทันที ---
        // เช็คชื่อตารางใน DB คุณให้ดีนะครับ (user_devices หรือ devices)
        // ตามภาพที่คุณเคยส่งมา ตารางชื่อ 'user_devices'
        const addDeviceQuery = `
            INSERT INTO user_devices (user_id, device_id, device_name, location) 
            VALUES ($1, $2, $3, $4)
        `;
        
        // กำหนดให้ทุกคนได้ 'ESP32_001' เหมือนกัน
        await client.query(addDeviceQuery, [newUserId, 'ESP32_001', 'อุปกรณ์เริ่มต้น', 'A']);

        await client.query('COMMIT'); // ยืนยันการบันทึกข้อมูลทั้งหมดลงฐานข้อมูล

        res.status(201).json({ 
            msg: "สมัครสมาชิกและเพิ่มอุปกรณ์สำเร็จ", 
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
