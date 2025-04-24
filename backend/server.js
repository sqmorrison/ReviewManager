const express = require('express')
const cors = require('cors')
const {v4:uuidv4} = require('uuid')
const sqlite3 = require('sqlite3').verbose()


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
