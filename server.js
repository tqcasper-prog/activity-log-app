const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('<h1>ระบบบันทึกกิจกรรม (Activity Log System)</h1><p>เชื่อมต่อและรันบน Docker สำเร็จ!</p>');
});

app.listen(port, () => {
  console.log(`App running on http://localhost:${port}`);
});