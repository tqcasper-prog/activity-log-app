# Life & Health Planner — Product & Technical Specification

- Repository: tqcasper-prog/activity-log-app
- Active MVP branch: feat/life-health-planner-mvp
- Updated: 2026-11-26

## Product goal
เว็บแอปภาษาไทยสำหรับวางแผนชีวิต ติดตามเวลา ออกกำลังกาย โภชนาการ และข้อมูลร่างกาย ใช้ได้ทั้ง Desktop และ Mobile

## Implemented MVP
1. Dashboard จากข้อมูลวันนี้
2. ตารางชีวิตแบบวันที่จริงและเวลาเริ่ม/สิ้นสุด พร้อมเพิ่ม แก้ไข ลบ สถานะ และเตือนช่วงเวลาทับซ้อน
3. บันทึกเวลาจริงตามวันที่และระยะเวลา
4. แผนออกกำลังกายเริ่มต้นพร้อมคำแนะนำท่าและบันทึก session
5. บันทึกอาหาร ปริมาณ พลังงาน สารอาหาร และแหล่งที่มาของค่าประมาณ
6. ประวัติข้อมูลร่างกายแบบลงวันที่และ BMI screening
7. รายงานสัปดาห์ เดือน ปี และช่วงวันที่กำหนดเองจากข้อมูลจริง
8. ตั้งค่า timezone วันเริ่มสัปดาห์ เวลาเริ่มวัน/นอน และเป้าหมายตัวอย่าง
9. ส่งออก/นำเข้า JSON และลบข้อมูลในแอป
10. ย้ายข้อมูล LocalStorage รุ่นเดิมโดยเก็บ key เดิมไว้

## Storage and privacy
LocalStorage only; no authentication, cloud sync, external AI, analytics, or external health-data transfer. Export backups regularly.

## Architecture
Node.js + Express static hosting, plain HTML/CSS/JavaScript. Domain calculations in public/js/domain.js. Node built-in test runner.

## Known limitations
- No cloud persistence or cross-device sync.
- Weekly recurrence creates six additional occurrences; series editing is not implemented.
- Overlaps warn before save but confirmed overlaps are still included in raw totals.
- Exercise plan is a generic starter example, not an individualized medical plan.
- No automated browser end-to-end test.
- Import validation and timezone behavior require further hardening.
