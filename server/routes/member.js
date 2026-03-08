// ดึงข้อมูล water_quality ล่าสุด (Realtime) ตาม Device ID
router.get("/water-quality", verifyToken, async (req, res) => {
    const { deviceId } = req.query;

    if (!deviceId) {
        return res.status(400).json({ msg: "Missing deviceId parameter" });
    }

    try {

        // ตรวจสอบสิทธิ์ว่า user มี device นี้หรือไม่
        const deviceCheck = await pool.query(
            "SELECT * FROM user_devices WHERE device_id = $1 AND user_id = $2",
            [deviceId, req.user.id]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(403).json({ msg: "คุณไม่มีสิทธิ์เข้าถึงอุปกรณ์นี้" });
        }

        // ดึงข้อมูลล่าสุดของ sensor
        const result = await pool.query(
            `SELECT device_id,
                    dissolved_oxygen,
                    ph,
                    temperature,
                    turbidity,
                    recorded_at
             FROM water_quality
             WHERE device_id = $1
             ORDER BY recorded_at DESC
             LIMIT 1`,
            [deviceId]
        );

        // ถ้าไม่มีข้อมูล
        if (result.rows.length === 0) {
            return res.status(404).json({ msg: "No sensor data found" });
        }

        // ส่งข้อมูลล่าสุดกลับไป
        res.json(result.rows[0]);

    } catch (err) {
        console.error("Water quality fetch error:", err);
        res.status(500).json({ error: "Server Error " + err.message });
    }
});

export default router;
