import express from "express";
import pool from "../db/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { verifyToken } from "../middleware/auth.js";

dotenv.config();

const router = express.Router();

// สร้าง Token
const genToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};


// =========================
// LOGIN
// =========================
router.post("/login", async (req, res) => {

    const { email, password } = req.body;

    try {

        const user = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ msg: "ไม่พบ Email" });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.rows[0].password
        );

        if (!validPassword) {
            return res.status(400).json({ msg: "Password ไม่ถูกต้อง" });
        }

        const token = genToken(user.rows[0]);

        await pool.query(
            "INSERT INTO login_logs (email, login_time, status) VALUES ($1, NOW(), $2)",
            [email, "online"]
        );

        res.json({
            msg: "เข้าสู่ระบบสำเร็จ",
            token
        });

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Server Error " + err.message
        });

    }
});


// =========================
// LOGOUT
// =========================
router.post("/logout", verifyToken, async (req, res) => {

    const email = req.user.email;

    try {

        await pool.query(
            `UPDATE login_logs
             SET status = $1
             WHERE email = $2
             AND id = (
                SELECT id FROM login_logs
                WHERE email = $2
                ORDER BY login_time DESC
                LIMIT 1
             )`,
            ["offline", email]
        );

        res.json({ msg: "ออกจากระบบสำเร็จ" });

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Server Error " + err.message
        });

    }
});


// =========================
// PROFILE
// =========================
router.get("/", verifyToken, async (req, res) => {

    try {

        const user = await pool.query(
            "SELECT id,name,email,created_at FROM users WHERE id=$1",
            [req.user.id]
        );

        res.json(user.rows[0]);

    } catch (err) {

        console.error(err);
        res.status(500).json({
            message: "เกิดข้อผิดพลาดในระบบ"
        });

    }
});


// =========================
// REGISTER
// =========================
router.post("/", async (req, res) => {

    const { name, email, password } = req.body;

    try {

        const userExists = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.json({
                msg: "Email นี้มีการใช้งานแล้ว"
            });
        }

        const hashedPass = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            "INSERT INTO users (name,email,password) VALUES ($1,$2,$3) RETURNING name,email",
            [name, email, hashedPass]
        );

        res.status(201).json({
            msg: "สมัครสมาชิกสำเร็จ",
            user: newUser.rows[0]
        });

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Server Error: " + err.message
        });

    }
});


// =========================
// LOGIN LOGS
// =========================
router.get("/login-logs", verifyToken, async (req, res) => {

    try {

        const logs = await pool.query(
            "SELECT email,login_time,status FROM login_logs WHERE email=$1 ORDER BY login_time DESC",
            [req.user.email]
        );

        res.json(logs.rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Server Error " + err.message
        });

    }
});


// =========================
// REALTIME SENSOR DATA
// =========================
router.get("/water-quality", verifyToken, async (req, res) => {

    const { deviceId } = req.query;

    if (!deviceId) {
        return res.status(400).json({
            msg: "Missing deviceId parameter"
        });
    }

    try {

        const deviceCheck = await pool.query(
            "SELECT * FROM user_devices WHERE device_id=$1 AND user_id=$2",
            [deviceId, req.user.id]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(403).json({
                msg: "คุณไม่มีสิทธิ์เข้าถึงอุปกรณ์นี้"
            });
        }

        const result = await pool.query(
            `SELECT device_id,
                    dissolved_oxygen,
                    ph,
                    temperature,
                    turbidity,
                    recorded_at
             FROM water_quality
             WHERE device_id=$1
             ORDER BY recorded_at DESC
             LIMIT 1`,
            [deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                msg: "No sensor data found"
            });
        }

        res.json(result.rows[0]);

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Server Error " + err.message
        });

    }
});


// =========================
// RECEIVE SENSOR DATA
// =========================
router.post("/water-quality-sensor", async (req, res) => {

    const {
        dissolved_oxygen,
        ph,
        temperature,
        turbidity,
        device_id
    } = req.body;

    if (!dissolved_oxygen || !ph || !temperature || !turbidity || !device_id) {

        return res.status(400).json({
            msg: "Missing required fields"
        });

    }

    try {

        const result = await pool.query(
            `INSERT INTO water_quality
            (dissolved_oxygen,ph,temperature,turbidity,device_id)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *`,
            [
                dissolved_oxygen,
                ph,
                temperature,
                turbidity,
                device_id
            ]
        );

        console.log("sensor data saved:", result.rows[0]);

        res.status(201).json({
            msg: "Data saved",
            data: result.rows[0]
        });

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Server Error " + err.message
        });

    }
});


export default router;
