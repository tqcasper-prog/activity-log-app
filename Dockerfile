# ใช้ Node.js เป็นสภาพแวดล้อมพื้นฐาน
FROM node:18-alpine

# กำหนดพื้นที่ทำงานใน Container
WORKDIR /usr/src/app

# คัดลอกไฟล์ package.json และติดตั้ง Dependencies
COPY package*.json ./
RUN npm install

# คัดลอกไฟล์โค้ดทั้งหมดเข้าไป
COPY . .

# กำหนดพอร์ตที่ใช้
EXPOSE 3000

# คำสั่งรันแอปพลิเคชันเมื่อเปิด Container
CMD [ "npm", "start" ]