import express      from 'express';
import cors         from 'cors';
import Router       from './routes/index.js';
import connectDB    from './config/db.js';
import path         from 'path';
import dotenv       from 'dotenv';
dotenv.config();



const app   = express();
const port  = process.env.PORT || 3000;

// Cấu hình CORS
const corsOptions = {
    origin: ['https://lib.hieurury.id.vn', 'https://adminlib.hieurury.id.vn', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
};

try {
    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    //public folder
    const __dirname = path.resolve();
    //public folder for image
    app.use('/public', express.static(path.join(__dirname, 'src/public')));



    //use middleware for routes
    Router(app);
    connectDB();


    app.listen(port, () => {
        console.clear();
        console.log(`
    SERVER IS RUNNING
    ----------------------------
    > ✅ server is started
    visit http://localhost:${port}
    ----------------------------
        `);
    });
    
} catch (error) {
    console.error('Error occurred:', error);
}