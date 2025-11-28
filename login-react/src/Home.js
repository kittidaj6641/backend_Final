import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Info,
  Phone,
  LogOut,
  Search,
  Fish,
  AlertTriangle,
  Clock,
  Shrimp,
  Activity,
  PlusCircle, // 🚀 ไอคอนสำหรับปุ่มเพิ่มอุปกรณ์
  ChevronDown
} from 'lucide-react';

import config from './config';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [modal, setModal] = useState({ isOpen: false, title: '', content: '' });
  const [waterData, setWaterData] = useState([]);
  const [error, setError] = useState('');

  // 🚀 State สำหรับจัดการอุปกรณ์
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    // ตั้งค่าพื้นหลังให้เต็มจอ
    document.body.style.minHeight = '100vh';
    document.body.style.margin = '0';

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // 1. ดึงข้อมูลอุปกรณ์ทั้งหมดของ User
    const fetchDevices = async () => {
      try {
        const response = await axios.get(`${config.API_BASE_URL}/member/devices`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data && response.data.length > 0) {
          setDevices(response.data);
          // ถ้ายังไม่ได้เลือกอุปกรณ์ ให้เลือกตัวแรกเป็นค่าเริ่มต้น
          if (!selectedDeviceId) {
            setSelectedDeviceId(response.data[0].device_id);
          }
        } else {
          setDevices([]);
        }
      } catch (err) {
        console.error("Error fetching devices:", err);
        // ไม่ต้อง set error ที่นี่ เพราะอาจจะแค่ยังไม่มีอุปกรณ์
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();

    return () => {
      document.body.style.minHeight = '';
      document.body.style.margin = '';
    };
  }, [navigate, selectedDeviceId]); // เพิ่ม selectedDeviceId เพื่อแก้ ESLint warning

  // 2. ดึงข้อมูลคุณภาพน้ำเมื่อ selectedDeviceId เปลี่ยน
  useEffect(() => {
    if (!selectedDeviceId) return;

    const token = localStorage.getItem('token');
    const fetchWaterQuality = async () => {
      try {
        const response = await axios.get(
          `${config.API_BASE_URL}/member/water-quality?deviceId=${selectedDeviceId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('API Response:', response.data);
        if (response.data && response.data.length > 0) {
          setWaterData(response.data);
          setError('');
        } else {
          setWaterData([]);
          // setError('ไม่พบข้อมูลคุณภาพน้ำสำหรับอุปกรณ์นี้'); // ไม่ต้องแสดง error แดงๆ แค่กราฟว่างๆ ก็พอ
        }
      } catch (err) {
        setError(
          'ไม่สามารถดึงข้อมูลคุณภาพน้ำได้: ' +
          (err.response?.data?.error || err.message)
        );
        console.error('Error fetching water quality:', err);
      }
    };

    fetchWaterQuality();
  }, [selectedDeviceId]);


  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/member/logout`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.status === 200) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        alert('การออกจากระบบล้มเหลว');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการออกจากระบบ');
      console.error(error);
    }
  };

  const openModal = (title, content) => {
    setModal({ isOpen: true, title, content });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', content: '' });
  };

  const latestData = waterData.length > 0 ? waterData[0] : null;

  const chartData = latestData
    ? [
      { name: 'ความเค็ม (ppt)', value: Number(latestData.salinity) || 0 },
      { name: 'pH', value: Number(latestData.ph) || 0 },
      { name: 'ออกซิเจน (mg/L)', value: Number(latestData.dissolved_oxygen) || 0 },
      { name: 'ไนโตรเจน (mg/L)', value: Number(latestData.nitrogen) || 0 },
      { name: 'ไฮโดรเจนซัลไฟด์ (mg/L)', value: Number(latestData.hydrogen_sulfide) || 0 },
      { name: 'BOD (mg/L)', value: Number(latestData.bod) || 0 },
      { name: 'อุณหภูมิ (°C)', value: Number(latestData.temperature) || 0 },
    ]
    : [
      { name: 'ความเค็ม (ppt)', value: 0 },
      { name: 'pH', value: 0 },
      { name: 'ออกซิเจน (mg/L)', value: 0 },
      { name: 'ไนโตรเจน (mg/L)', value: 0 },
      { name: 'ไฮโดรเจนซัลไฟด์ (mg/L)', value: 0 },
      { name: 'BOD (mg/L)', value: 0 },
      { name: 'อุณหภูมิ (°C)', value: 0 },
    ];

  const checkAlerts = () => {
    if (!latestData) return 'ไม่มีข้อมูลคุณภาพน้ำให้ตรวจสอบ';
    const alerts = [];
    if (latestData.salinity < 0 || latestData.salinity > 15) alerts.push(`ความเค็ม (${latestData.salinity} ppt) อยู่นอกเกณฑ์`);
    if (latestData.ph < 7.0 || latestData.ph > 8.5) alerts.push(`pH (${latestData.ph}) อยู่นอกเกณฑ์`);
    if (latestData.dissolved_oxygen < 5) alerts.push(`ออกซิเจน (${latestData.dissolved_oxygen} mg/L) ต่ำเกินไป`);
    if (latestData.nitrogen > 1) alerts.push(`ไนโตรเจน (${latestData.nitrogen} mg/L) สูงเกินไป`);
    if (latestData.hydrogen_sulfide > 0.1) alerts.push(`ก๊าซไข่เน่า (${latestData.hydrogen_sulfide} mg/L) สูงเกินไป`);
    if (latestData.bod > 10) alerts.push(`BOD (${latestData.bod} mg/L) สูงเกินไป`);
    if (latestData.temperature < 26 || latestData.temperature > 32) alerts.push(`อุณหภูมิ (${latestData.temperature}°C) อยู่นอกเกณฑ์`);
    return alerts.length === 0 ? 'คุณภาพน้ำอยู่ในเกณฑ์ปกติ' : alerts.join('\n');
  };

  const handleAlertClick = () => {
    const alertContent = checkAlerts();
    openModal('⚠️ การแจ้งเตือนคุณภาพน้ำ', alertContent);
  };

  const fetchLoginLogs = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      openModal('📜 ประวัติการใช้งาน', 'ไม่พบ token กรุณาล็อกอินใหม่');
      return;
    }
    try {
      const response = await axios.get(`${config.API_BASE_URL}/member/login-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data && response.data.length > 0) {
        const tableContent = `
          <table class="login-logs-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>อีเมล</th>
                <th>เวลาที่ล็อกอิน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${response.data.map((log, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${log.email}</td>
                  <td>${new Date(log.login_time).toLocaleString('th-TH')}</td>
                  <td class="${log.status === 'online' ? 'status-online' : 'status-offline'}">${log.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        openModal('📜 ประวัติการใช้งาน', tableContent);
      } else {
        openModal('📜 ประวัติการใช้งาน', 'ไม่มีข้อมูลประวัติการล็อกอิน');
      }
    } catch (err) {
      openModal('📜 ประวัติการใช้งาน', 'ไม่สามารถดึงข้อมูลประวัติการล็อกอินได้');
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF6384', '#36A2EB', '#FFCE56'];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ duration: 0.5 }}
      className="home-page"
    >
      <header className="header">
        <nav className="nav">
          <a href="/water-quality"><BarChart size={18} /> ข้อมูลคุณภาพน้ำ</a>
          <a href="#about" onClick={(e) => {
            e.preventDefault();
            openModal('ℹ️ เกี่ยวกับเรา', 'ฟาร์มกุ้งก้ามกรามคุณภาพสูง...');
          }}><Info size={18} /> เกี่ยวกับเรา</a>
          <a href="/shrimp-info" onClick={(e) => {
            e.preventDefault();
            navigate('/shrimp-info');
          }}><Shrimp size={18} /> เกี่ยวกับกุ้ง</a>
          <a href="#contact" onClick={(e) => {
            e.preventDefault();
            openModal('📞 ติดต่อเรา', 'Email: farm@example.com\nTel: 123-456-7890');
          }}><Phone size={18} /> ติดต่อเรา</a>
          <button className="alert-btn" onClick={handleAlertClick}><AlertTriangle size={18} /> การแจ้งเตือน</button>
          <button className="history-btn" onClick={fetchLoginLogs}><Clock size={18} /> ประวัติ</button>
          <button className="logout-btn" onClick={handleLogout}><LogOut size={18} /> ออกจากระบบ</button>
        </nav>
      </header>

      <div className="main-content">
        <div className="content-left"></div>
        <div className="content-right">
          <h1><Fish size={32} /> ยินดีต้อนรับสู่ฟาร์มกุ้งก้ามกราม</h1>
          <h2>เพื่อคุณภาพน้ำที่ดี</h2>
          <p>จัดการฟาร์มของคุณด้วยข้อมูลคุณภาพน้ำแบบเรียลไทม์</p>

          {/* 🚀 ส่วนเลือกอุปกรณ์ */}
          {!loadingDevices && (
            <div className="device-selector-container" style={{ marginBottom: '20px', textAlign: 'center' }}>
              {devices.length > 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'white', padding: '10px 20px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>📡 เลือกอุปกรณ์:</span>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      style={{
                        padding: '8px 30px 8px 15px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        fontSize: '16px',
                        appearance: 'none',
                        backgroundColor: '#f8f9fa',
                        cursor: 'pointer',
                        outline: 'none',
                        fontWeight: '500',
                        color: '#007bff'
                      }}
                    >
                      {devices.map(device => (
                        <option key={device.id} value={device.device_id}>
                          {device.device_name} ({device.device_id})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666' }} />
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', background: '#fff3cd', color: '#856404', borderRadius: '10px', display: 'inline-block' }}>
                  ⚠️ ยังไม่มีอุปกรณ์ในระบบ กรุณาเพิ่มอุปกรณ์ก่อนใช้งาน
                </div>
              )}
            </div>
          )}

          {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

          {/* แสดงกราฟเฉพาะเมื่อมีอุปกรณ์ */}
          {devices.length > 0 && (
            <div style={{ width: '100%', maxWidth: 400, height: 350, marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={130} fill="#8884d8">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 🚀 กลุ่มปุ่มกด */}
          <div className="button-group">
            {devices.length > 0 && (
              <button className="action-btn" onClick={() => navigate(`/realtime?deviceId=${selectedDeviceId}`)}>
                <Activity size={20} /> ดูข้อมูล Realtime
              </button>
            )}

            {/* 🚀 ปุ่มเพิ่มอุปกรณ์ */}
            <button
              className="action-btn"
              onClick={() => navigate('/add-device')}
              style={{ background: 'linear-gradient(135deg, #28a745 0%, #218838 100%)' }} // สีเขียว
            >
              <PlusCircle size={20} /> เพิ่มอุปกรณ์
            </button>

            {devices.length > 0 && (
              <button className="action-btn" onClick={() => navigate(`/water-quality?deviceId=${selectedDeviceId}`)}>
                <Search size={20} /> ดูข้อมูลย้อนหลัง
              </button>
            )}
          </div>
        </div>
      </div>

      {modal.isOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{modal.title}</h2>
            <div className="modal-content" dangerouslySetInnerHTML={{ __html: modal.content }} />
            <button className="close-btn" onClick={closeModal}>ปิด</button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Home;
