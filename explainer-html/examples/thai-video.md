---
schema: 1
title: "แคชช่วยให้ระบบตอบเร็วขึ้นอย่างไร"
subtitle: "ตามคำขอหนึ่งรายการ จากผู้ใช้ไปถึงข้อมูล"
lang: th
theme: shadcn
video: on
voice: auto
---
## เริ่มจากคำขอ

ผู้ใช้ส่งคำขอไปที่ API ซึ่งเป็นจุดรับงานของระบบ

```architecture
nodes:
  browser: {label: "🌐 ผู้ใช้", kind: client}
  api: {label: "API", kind: service}
edges:
  - {id: request, from: browser, to: api, label: "ขอข้อมูล"}
```

```beats
- narration: "ผู้ใช้ขอข้อมูลผ่าน API"
  focus: [browser, api]
  state: {api: active}
```

## ค้นในแคชก่อน

ถ้าพบข้อมูลในแคช ระบบส่งคำตอบได้ทันที หากไม่พบ จึงอ่านฐานข้อมูล

```architecture
nodes:
  browser: {label: "🌐 ผู้ใช้", kind: client}
  api: {label: "API", kind: service}
  cache: {label: "แคช", kind: database}
  database: {label: "ฐานข้อมูล", kind: database}
edges:
  - {id: request, from: browser, to: api, label: "ขอข้อมูล"}
  - {id: lookup, from: api, to: cache, label: "ค้นหา"}
  - {id: fallback, from: api, to: database, label: "เมื่อไม่พบ", kind: async}
```

```beats
- narration: "API ค้นในแคชก่อน ถ้าไม่พบจึงอ่านฐานข้อมูล"
  focus: [api, cache, database]
  reveal: [cache, database, lookup, fallback]
  state: {cache: active, database: warning}
- narration: "แคชเป็นสำเนาชั่วคราว ฐานข้อมูลยังเป็นแหล่งข้อมูลหลัก"
  focus: [cache, database]
  state: {cache: done, database: done}
```
