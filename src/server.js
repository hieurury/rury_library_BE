import express from 'express';
import cors from 'cors';
import Router from './routes/index.js';
import connectDB from './config/db.js';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
dotenv.config();



const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//public folder
const __dirname = path.resolve();
//public folder for image
app.use('/public', express.static(path.join(__dirname, 'src/public')));



//use middleware for routes
Router(app);
connectDB();

app.get('/', (req, res) => {
  return res.json({
    status: "true",
    message: "hello hieurury"
  })
});

app.listen(port, () => {
    // console.clear();
    console.log(`
SERVER IS RUNNING
----------------------------
> ✅ server is started
visit http://localhost:${port}
----------------------------
    `);
});