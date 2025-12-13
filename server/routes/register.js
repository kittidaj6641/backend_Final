import express from "express";
import pool from "../db/db.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
app.post('/register', async (req, res) => {
    const { username, password, name } = req.body;

    // เริ่ม Transaction (แนะนำ เพื่อความชัวร์ ถ้าพังให้พังทั้งคู่)
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // เริ่มกระบวนการ

        // 1. สร้าง User ใหม่ และขอ ID กลับมาทันที (RETURNING id)
        const userQuery = `
            INSERT INTO users (username, password, name) 
            VALUES ($1, $2, $3) 
            RETURNING id
        `;
        const userResult = await client.query(userQuery, [username, password, name]);
        
        // รับค่า ID ของ User ที่เพิ่งสมัคร
        const newUserId = userResult.rows[0].id;

        // 2. เพิ่มอุปกรณ์เริ่มต้น (ESP32_001) ให้ User คนนี้ทันที
        const deviceQuery = `
            INSERT INTO user_devices (user_id, device_id, device_name, location) 
            VALUES ($1, $2, $3, $4)
        `;
        // ค่า Default: device_id = 'ESP32_001', ชื่อ = 'อุปกรณ์เริ่มต้น', สถานที่ = 'A'
        await client.query(deviceQuery, [newUserId, 'ESP32_001', 'อุปกรณ์เริ่มต้น', 'A']);

        await client.query('COMMIT'); // บันทึกข้อมูลทั้งหมดลงฐานข้อมูลจริง

        // 3. ส่ง Response กลับไปหาหน้าเว็บ (ส่งแค่ครั้งเดียวตรงนี้)
        res.json({ 
            status: 'success', 
            message: 'สมัครสมาชิกและเพิ่มอุปกรณ์สำเร็จ' 
        });

    } catch (err) {
        await client.query('ROLLBACK'); // ถ้ามีอะไรผิดพลาด ให้ยกเลิกการบันทึกทั้งหมด
        console.error(err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    } finally {
        client.release(); // คืน Connection
    }
});
export default router;
