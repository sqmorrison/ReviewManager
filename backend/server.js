const express = require('express')
const cors = require('cors')
const {v4:uuidv4} = require('uuid')
const sqlite3 = require('sqlite3').verbose()
const datNow = new Date();

//install bcrypt
const dbSource = "review.db"
const HTTP_PORT = 8000
const db = new sqlite3.Database(dbSource)

var app = express()
const corsOptions = {
    origin: 'http://localhost:3000', // Replace with your frontend's URL
    credentials: true // Allow credentials (cookies, etc.)
};
app.use(cors(corsOptions))
app.use(express.json())

/* 
UserID INTEGER PRIMARY KEY AUTOINCREMENT,
    FirstName TEXT NOT NULL,
    LastName TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    Password TEXT NOT NULL,
    CreationDateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    LastLoginDateTime DATETIME
*/

app.post('/studentRegister', (req, res, next) => {
    const { strFullName, strEmail, strPassword, strConfirmPass, strClassCode } = req.body;

    if (strPassword != strConfirmPass) {
        res.status(401).json({message:"Passwords Must Match"})
    }

    const arrName = strFullName.split(" ");

    const strFirstName = arrName[0];
    const strLastName = arrName[1];

    if (!strClassCode) {
        const strCommand = 'INSERT INTO tblUsers (FirstName, LastName, Email, Password, CreationDateTime) VALUES (?,?,?,?,?)';
    }
    else {
        const strCommand = 'INSERT INTO tblUsers (username, email, password) VALUES (?,?,?)';
    }
})

app.post('/login', (req, res, next) => {
    
})

app.get('/logout', (req, res) => {

})

app.get('/teams', (req, res, next) => {
    const strEmail = req.query.email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strEmail)) {
        return res.status(400).json({ error: "You must provide a valid email address" });
    }

    const strCommand = `
        SELECT tblTeams.team_id, tblTeams.name, tblTeams.description, tblRoles.role
        FROM tblRoles
        JOIN tblTeams ON tblTeams.team_id = tblRoles.team_id
        JOIN tblUsers ON tblUsers.UserID = tblRoles.user_id
        WHERE tblUsers.Email = ?
    `;

    db.all(strCommand, [strEmail], function (err, rows) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            const instructor = rows.filter(r => r.role === 'instructor');
            const student = rows.filter(r => r.role === 'student');
            res.json({
                status: "success",
                instructor,
                student
            });
        }
    });
});



app.listen(HTTP_PORT,() => {
    console.log('App listening on',HTTP_PORT)
})
