---
schema: 1
title: "Cache Hit: จาก Client ผ่าน API ไปยัง Redis"
lang: th
---

## ข้อมูลที่มีอยู่ในแคชแล้ว

ตัวอย่างนี้สมมติว่า API ใช้รูปแบบ cache-aside และ Redis มีข้อมูลที่ยังใช้ได้สำหรับคำขอนี้ API จึงส่งข้อมูลจากแคชกลับไปโดยไม่ต้องอ่านฐานข้อมูลหลัก เวลาในการตอบจริงขึ้นกับระบบและเครือข่าย

```architecture
direction: LR
nodes:
  client: {label: "📱 Client", kind: client, description: "Web / Mobile App"}
  api: {label: "⚡ API Service", kind: service, description: "Backend Application"}
  redis: {label: "📦 Redis Cache", kind: database, description: "In-Memory Store (RAM)"}
  db: {label: "🗄️ Main Database", kind: database, description: "Primary data store"}
edges:
  - {id: request, from: client, to: api, label: "1. Request (GET /products/101)"}
  - {id: lookup, from: api, to: redis, label: "2. ค้นหาคีย์ (GET product:101)"}
  - {id: hit, from: redis, to: api, label: "3. Cache Hit (ส่งข้อมูลใน RAM)", kind: response}
  - {id: response, from: api, to: client, label: "4. Response 200 OK (JSON)", kind: response}
groups:
  - {id: backend, label: "ระบบฝั่งเซิร์ฟเวอร์ (Backend Boundary)", members: [api, redis, db]}
```

Client ส่งคำขอไปที่ API จากนั้น API ค้นหาคีย์ใน Redis เมื่อพบข้อมูล Redis ส่งค่ากลับมา และ API ตอบ Client ฐานข้อมูลหลักยังปรากฏในภาพเพื่อให้เห็นส่วนของระบบที่ไม่ได้ถูกอ่านในเส้นทางนี้

## สิ่งที่ต้องออกแบบร่วมกัน

| เรื่อง | แนวทาง |
| --- | --- |
| ประโยชน์ | [✓] ลดการอ่านฐานข้อมูลหลักสำหรับคำขอที่พบข้อมูลในแคช |
| ความสดของข้อมูล | [!] เลือก TTL และวิธีล้างหรืออัปเดตแคชให้เหมาะกับข้อมูล |
| ไม่พบข้อมูล | [!] เส้นทาง cache miss ต้องอ่านจากแหล่งข้อมูลและกำหนดวิธีเติมแคช |
| Redis ใช้งานไม่ได้ | [!] กำหนด timeout และพฤติกรรม fallback โดยคำนึงถึงกำลังรองรับของฐานข้อมูล |
