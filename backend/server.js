const express = require('express')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const datNow = new Date();
const upload = multer({ storage: multer.memoryStorage() }); // Use in-memory storage for BLOB
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const HTTP_PORT = 8000
const db = new sqlite3.Database("./review.db")

var app = express();
const corsOptions = {
    origin: 'http://localhost:3000', // Replace with frontend's URL
    credentials: true // Allow credentials (cookies, etc.)
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'your_secret_key', // Use env variable in production
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 720 * 60 * 1000 } // Adjust for HTTPS in prod
}));


//temporary no reply email for multifactor auth
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'jaydon.medhurst@ethereal.email',
        pass: 'dryJ2czqz7cETXqws8'
    }

});

app.post('/studentRegister', (req, res, next) => {
    const { strFullName, strEmail, strPassword, strConfirmPass, strClassCode } = req.body;

    console.log(strPassword)
    console.log(strConfirmPass)

    if (strPassword != strConfirmPass) {
        res.status(401).json({ message: "Passwords Must Match" })
    }
    //hash the password before it can be stored on the database
    const strHashedPassword = bcrypt.hashSync(strPassword, 10);

    //split the full name into first and last name
    const arrName = strFullName.split(" ");
    const strFirstName = arrName[0];
    const strLastName = arrName[1];

    if (!strClassCode) {
        const strCommand = 'INSERT INTO tblUsers (FirstName, LastName, Email, Password) VALUES (?,?,?,?)';

        db.run(strCommand, [strFirstName, strLastName, strEmail, strHashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Email already exists' });
                }
                else {
                    res.status(500).json({ message: 'Database error', details: err.message });
                }
            }
            else {
                return res.status(201).json({ message: 'User registered successfully' });
            }
        })
    }
    else {
        //no class code for now, that's a bigger issue for later
        //later need to implement a way to immediately connect a student to a class upon registration
        const strCommand = 'INSERT INTO tblUsers (FirstName, LastName, Email, Password) VALUES (?,?,?,?)';

        db.run(strCommand, [strFirstName, strLastName, strEmail, strHashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Email already exists' });
                }
                else {
                    res.status(500).json({ message: 'Database error', details: err.message });
                }
            }
            else {
                return res.status(201).json({ message: 'User registered successfully' });
            }
        })
    }
})

app.post('/instructorRegister', (req, res, next) => {
    const { strInFullName, strInEmail, strInPass, strInConfPass } = req.body;

    if (strInPass != strInConfPass) {
        res.status(401).json({ message: "Passwords Must Match" })
    }

    if (!strInFullName.includes(' ')) {
        return res.status(400).json({ message: "Full name must include both first and last name separated by a space" });
    }

    //hash the password before it can be stored on the database
    const strHashedPassword = bcrypt.hashSync(strInPass, 10);

    //split the full name into first and last name
    const arrName = strInFullName.split(" ");
    const strFirstName = arrName[0];
    const strLastName = arrName[1];

    const verificationCode = Math.floor(100000 + Math.random() * 900000); // mfa

    const strCommand = 'INSERT INTO tblUsers (FirstName, LastName, Email, Password) VALUES (?,?,?,?)';

    db.run(strCommand, [strFirstName, strLastName, strInEmail, strHashedPassword], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                res.status(400).json({ error: 'Email already exists' });
            }
            else {
                res.status(500).json({ message: 'Database error', details: err.message });
            }
        }
        else {
            return res.status(201).json({ message: 'User registered successfully' });
        }
    })
});

app.post('/instructorCourseRegister', (req, res, next) => {
    const { strEmail, arrCourses } = req.body;

    arrCourses.forEach(course => {
        const strCommand = `
            INSERT INTO tblCourses 
            (CourseName, CourseNumber, CourseSection, CourseTerm, StartDate, EndDate, JoinCode) 
            VALUES (?,?,?,?,?,?,?)
        `;

        const intJoinCode = Math.floor(100000 + Math.random() * 900000);

        // Insert the course into tblCourses
        db.run(
            strCommand,
            [
                course.strCourseName,
                course.strCourseNumber,
                course.strCourseSection,
                course.strCourseTerm,
                course.dtStartDate,
                course.dtEndDate,
                intJoinCode
            ],
            function (err) {
                if (err) {
                    console.error('[ERROR] Insert into tblCourses failed:', err.message);
                    return res.status(500).json({ message: 'Database error', details: err.message });
                }

                // Retrieve the last inserted CourseID
                const courseID = this.lastID;

                const strCommand2 = 'SELECT UserID FROM tblUsers WHERE Email = ?';
                const strCommand3 = 'INSERT INTO tblEnrollments (UserID, CourseID, Role) VALUES (?,?,?)';

                // Get the UserID of the instructor
                db.get(strCommand2, [strEmail], function (err, row) {
                    if (err) {
                        console.error('[ERROR] Select UserID failed:', err.message);
                        return res.status(500).json({ message: 'Database error', details: err.message });
                    }

                    if (!row) {
                        return res.status(404).json({ message: 'Instructor not found' });
                    }

                    const strUserID = row.UserID;

                    // Insert the enrollment into tblEnrollments
                    db.run(strCommand3, [strUserID, courseID, "Instructor"], function (err) {
                        if (err) {
                            console.error('[ERROR] Insert into tblEnrollments failed:', err.message);
                            return res.status(500).json({ message: 'Database error', details: err.message });
                        }

                        console.log(`Course ${course.strCourseName} registered successfully for instructor ${strEmail}`);
                    });
                });
            }
        );
    });

    res.status(201).json({ message: 'Courses registered successfully' });
});

app.post('/login', (req, res, next) => {
    const { strEmail, strPassword } = req.body;

  db.get("SELECT * FROM tblUsers WHERE Email = ?", [strEmail], (err, user) => {
    if (err) return res.status(500).send('Server error');
    if (!user || !bcrypt.compareSync(strPassword, user.Password)) {
      return res.status(401).send('Invalid credentials');
    }
      
    // Generate MFA code and expiration
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins from now

    const insertMFA = `
      INSERT INTO tblMFA (UserID, Code, Expiration)
      VALUES (?, ?, ?)
    `;


    db.run(insertMFA, [user.UserID, mfaCode, expiresAt], function (err) {
      if (err) return res.status(500).send('Failed to save MFA code');
      transporter.sendMail({
        from: 'no-reply@jqreview.com',
        to: strEmail,
        subject: 'Your MFA Code',
        text: `Your MFA code is: ${mfaCode}`
      }, (err) => {
        if (err) return res.status(500).send('Failed to send MFA email');

          // Save UserID temporarily in session
          req.session.tempUserEmail = user.Email;
          res.status(200).json({ success: true });
      });
    });
  });
})

app.post('/mfa', (req, res) => {
    const { mfaCode } = req.body;
    const tempEmail = req.session.tempUserEmail;
  
    if (!tempEmail) return res.status(401).send('Session expired. Please log in again.');
  
    db.get("SELECT m.* FROM tblMFA m JOIN tblUsers u ON m.UserID = u.UserID WHERE u.Email = ? AND m.Status = 'active' AND m.Expiration > CURRENT_TIMESTAMP ORDER BY m.Expiration DESC LIMIT 1;", [tempEmail], (err, user) => {
        if (err || !user) return res.status(500).send('Server error');
      if (user.Code !== mfaCode || new Date(user.Expiration) < new Date()) {
        return res.status(401).send('Invalid or expired MFA code');
      }
  
      // MFA successful: finalize login
        req.session.user = tempEmail; // Establish full session
        delete req.session.tempUserEmail; // Remove temp session
        
        const useCommand = `
            UPDATE tblMFA
            SET Status = 'used'
            WHERE MFAID = (
                SELECT m.MFAID
                FROM tblMFA m
                JOIN tblUsers u ON m.UserID = u.UserID
                WHERE u.Email = ? AND m.Status = 'active'
                ORDER BY m.Expiration DESC
                LIMIT 1
            )
            `;
      db.run(useCommand, [tempEmail]);
      res.status(200).json({ success: true });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/session-info', (req, res) => {
    if (req.session.user) {
      res.json({ email: req.session.user});
    } else {
      res.status(401).json({ error: 'No session or session expired' });
    }
  });

app.get('/teams', (req, res, next) => {
    const strEmail = req.query.email?.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strEmail)) {
        return res.status(400).json({ error: "You must provide a valid email address" });
    }

    const strCommand = `
        SELECT 
            tblCourses.CourseID,
            tblCourses.CourseName,
            tblCourses.CourseSection,
            tblEnrollments.Role,
            tblUsers.FirstName,
            tblUsers.LastName
        FROM tblEnrollments
        JOIN tblUsers ON tblEnrollments.UserID = tblUsers.UserID
        JOIN tblCourses ON tblEnrollments.CourseID = tblCourses.CourseID
        WHERE LOWER(tblUsers.Email) = ?
    `;

    db.all(strCommand, [strEmail], (err, rows) => {
        if (err) {
            console.error("[ERROR] /teams DB error:", err.message);
            return res.status(500).json({
                status: "error",
                message: err.message
            });
        }

        const instructor = rows
            .filter(row => row.Role?.toLowerCase() === 'instructor')
            .map(row => ({
                team_id: row.CourseID,
                name: row.CourseName,
                description: `Section ${row.CourseSection}`
            }));

        const student = rows
            .filter(row => row.Role?.toLowerCase() === 'student')
            .map(row => ({
                team_id: row.CourseID,
                name: row.CourseName,
                description: `Section ${row.CourseSection}`
            }));

        const fullName = rows.length > 0
            ? `${rows[0].FirstName} ${rows[0].LastName}`
            : null;

        res.json({
            status: "success",
            fullName,
            instructor,
            student
        });
    });
});




// POST for creating a course
app.post('/courses', (req, res, next) => {
    const { strInstructorID, strCourseName, strCourseNumber, strCourseSection, strCourseTerm, dtStartDate, dtEndDate } = req.body;

    // need to pass in instructorID to the course creation function
    // check if the instructorID is valid
    const strCommandVerify = 'SELECT * FROM tblUsers WHERE UserID = ?';
    db.get(strCommandVerify, [strInstructorID], function (err, row) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else if (!row) {
            res.status(400).json({
                status: "error",
                message: "Instructor not found"
            });
        }
    });


    // UUID for the course
    const strCourseID = uuidv4();
    const strEnrollmentID = uuidv4();

    const strCommand = 'INSERT INTO tblCourses (CourseID, CourseName, CourseNumber, CourseSection, CourseTerm, StartDate, EndDate) VALUES (?,?,?,?,?,?,?)';

    // create the course in the database
    db.run(strCommand, [strCourseID, strCourseName, strCourseNumber, strCourseSection, strCourseTerm, dtStartDate, dtEndDate], function (err) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            res.json({
                status: "success",
                courseID: strCourseID,
                message: "Course created successfully"
            });
        }
    });

    // create the enrollment in the database (assign instructor to course)
    const strCommand2 = 'INSERT INTO tblEnrollments (EnrollmentID, CourseID, UserID) VALUES (?,?,?)';
    db.run(strCommand2, [strEnrollmentID, strCourseID, strInstructorID], function (err) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            res.json({
                status: "success",
                enrollmentID: strEnrollmentID,
                message: "Enrollment created successfully"
            });
        }
    });
});

app.get('/course-roster', (req, res) => {
    console.log("[DEBUG] /course-roster hit with query:", req.query);
    const courseId = parseInt(req.query.courseId);

    if (!courseId) {
        return res.status(400).json({ error: "Missing or invalid courseId" });
    }

    const query = `
      SELECT 
        tblUsers.FirstName || ' ' || tblUsers.LastName AS FullName,
        tblUsers.Email,
        tblEnrollments.Role,
        tblSocials.strDiscord,
        tblSocials.strTeams,
        tblSocials.strPhone,
        tblUsers.ProfilePhoto
      FROM tblEnrollments
      JOIN tblUsers ON tblEnrollments.UserID = tblUsers.UserID
      LEFT JOIN tblSocials ON tblUsers.Email = tblSocials.UserEmail
      WHERE tblEnrollments.CourseID = ?
    `;

    db.all(query, [courseId], (err, rows) => {
        if (err) {
            console.error("[ERROR] /course-roster:", err.message);
            return res.status(500).json({ error: "Database query failed" });
        }

        const formatted = rows.map(row => ({
            ...row,
            strProfilePhoto: row.ProfilePhoto
                ? `data:image/jpeg;base64,${row.ProfilePhoto.toString('base64')}`
                : null
        }));



        res.json(formatted);
    });
});



// GET for getting all course groups for a specific instructor
// assuming that the landing page for instructors simply shows all teams (tblCourseGroups) rather than all courses (tblCourses)
app.get('/instructorTeams', (req, res, next) => {
    const strEmail = req.query.email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strEmail)) {
        return res.status(400).json({ error: "You must provide a valid email address" });
    }

    const strCommand = `
        SELECT tblUsers.UserID, tblGroupMembers.UserID, tblCourseGroups.GroupID, tblCourseGroups.GroupName, tblCourses.JoinCode
        FROM tblUsers
        JOIN tblGroupMembers ON tblUsers.UserID = tblGroupMembers.UserID
        JOIN tblCourseGroups ON tblGroupMembers.GroupID = tblCourseGroups.GroupID
        JOIN tblCourses ON tblCourseGroups.CourseID = tblCourses.CourseID
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
            res.json({
                status: "success",
                instructor,
                student
            });
        }
    });
});

// GET for getting all members and assessments of a specific course group
app.get('/groupInfo', (req, res, next) => {
    const strGroupID = req.query.groupID.trim().toLowerCase();

    const strCommand = `
        SELECT tblUsers.UserID, tblUsers.FirstName, tblUsers.LastName, tblGroupMembers.GroupID, tblAssessments.AssessmentID, tblAssessments.AssessmentName, tblAssessments.CourseID
        FROM tblUsers
        JOIN tblGroupMembers ON tblUsers.UserID = tblGroupMembers.UserID
        JOIN tblCourseAssessments ON tblGroupMembers.GroupID = tblCourseAssessments.GroupID
        WHERE tblGroupMembers.GroupID = ?
    `;

    db.all(strCommand, [strGroupID], function (err, rows) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            res.json({
                status: "success",
                members: rows
            });
        }
    });
});

// PUT for updating a course group
// requires authentication to ensure that only the instructor can update the course group
app.put('/updateGroup', (req, res, next) => {
    // assuming that arrGroup members is an array of user IDs
    const { strGroupID, strGroupName, arrGroupMembers } = req.body;
    const strUserID = req.query.userID.trim().toLowerCase(); // instructor ID

    // verify that the instructor is in the group
    const strCommandVerify = 'SELECT * FROM tblGroupMembers WHERE GroupID = ? AND UserID = ?';
    db.get(strCommandVerify, [strGroupID, strUserID], function (err, row) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else if (!row) {
            res.status(400).json({
                status: "error",
                message: "Instructor not found in group"
            });
        }
    });

    const strCommand = 'UPDATE tblCourseGroups SET GroupName = ? WHERE GroupID = ?';

    db.run(strCommand, [strGroupName, strGroupID], function (err) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            res.json({
                status: "success",
                message: "Course group updated successfully"
            });
        }
    });

    // update tblGroupMembers to add or remove members from the group
    const strCommand2 = 'DELETE FROM tblGroupMembers WHERE GroupID = ?';
    db.run(strCommand2, [strGroupID], function (err) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            // add the new members to the group
            const strCommand3 = 'INSERT INTO tblGroupMembers (GroupID, UserID) VALUES (?,?)';
            arrGroupMembers.forEach(member => {
                db.run(strCommand3, [strGroupID, member], function (err) {
                    if (err) {
                        console.log(err);
                        res.status(400).json({
                            status: "error",
                            message: err.message
                        });
                    }
                });
            });
        }
    });
});

// DELETE for deleting a course group
// requires authentication to ensure that only the instructor can update the course group
app.delete('/deleteGroup', (req, res, next) => {
    const strGroupID = req.query.groupID.trim().toLowerCase();
    const strUserID = req.query.userID.trim().toLowerCase(); // instructor ID

    // verify that the instructor is in the group
    const strCommandVerify = 'SELECT * FROM tblGroupMembers WHERE GroupID = ? AND UserID = ?';
    db.get(strCommandVerify, [strGroupID, strUserID], function (err, row) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else if (!row) {
            res.status(400).json({
                status: "error",
                message: "Instructor not found in group"
            });
        }
    });

    // first, remove all members from the group
    const strCommandRemoveMembers = 'DELETE FROM tblGroupMembers WHERE GroupID = ?';
    db.run(strCommandRemoveMembers, [strGroupID], function (err) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        }
    });

    const strCommand = 'DELETE FROM tblCourseGroups WHERE GroupID = ?';

    db.run(strCommand, [strGroupID], function (err) {
        if (err) {
            console.log(err);
            res.status(400).json({
                status: "error",
                message: err.message
            });
        } else {
            res.json({
                status: "success",
                message: "Course group deleted successfully"
            });
        }
    });
});


app.get('/user-profile', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    console.log('[GET] /user-profile hit with email:', req.query.email);
    console.log("[DEBUG] Looking for user with email:", email);

    db.get(`SELECT FirstName || ' ' || LastName AS name, Email, strProfilePhoto FROM tblUsers WHERE Email = ?`, [email], (err, user) => {
        if (err) {
            console.error("[DEBUG] Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        console.log("[DEBUG] Query result:", user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        db.get(`
            SELECT strDiscord, strTeams, strPhone
            FROM tblSocials
            WHERE UserEmail = ?
          `, [email], (err2, socials) => {
            if (err2) {
                console.error("[DEBUG] Socials query error:", err2);
                return res.status(500).json({ error: "Socials query failed" });
            }

            res.json({
                ...user,
                discord: socials?.strDiscord || '',
                teams: socials?.strTeams || '',
                phone: socials?.strPhone || ''
            });
        });
    });
});


app.post('/user-profile/update', (req, res) => {
    console.log('[POST] /user-profile/update hit with body:', req.body);
    const { name, email, phone, discord, teams } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const [firstName, lastName = ''] = name.trim().split(' ');

    // First, update tblUsers
    db.run(
        `UPDATE tblUsers
         SET FirstName = ?, LastName = ?
       WHERE Email = ?`,
        [firstName, lastName, email],
        function (err) {
            if (err) {
                console.error('[UPDATE tblUsers] error:', err);
                return res.status(500).json({ error: 'Failed to update user' });
            }

            // Then upsert into tblSocials
            // (you need a UNIQUE(UserEmail) constraint for ON CONFLICT to work)
            db.run(
                `UPDATE tblSocials
               SET strDiscord = ?,
                   strTeams   = ?,
                   strPhone   = ?
             WHERE UserEmail = ?`,
                [discord, teams, phone, email],
                function (err) {
                    if (err) {
                        console.error('[UPDATE tblSocials] error:', err);
                        return res.status(500).json({ error: 'Failed to update socials' });
                    }
                    // If you want, you can check this.changes to see if any row was updated
                    if (this.changes === 0) {
                        // No row matched—handle as you like (e.g. return 404 or insert a new one)
                        console.warn('[UPDATE tblSocials] no row found to update for', email);
                    }
                    res.json({ message: 'Profile updated successfully' });
                }
            );
        }
    );
});


app.post('/user-profile/upload-photo', upload.single('profilePic'), (req, res) => {
    const email = req.body.email;
    const buffer = req.file?.buffer;

    if (!email || !buffer) {
        return res.status(400).json({ error: 'Email and image are required' });
    }

    db.run(
        `UPDATE tblUsers
           SET ProfilePhoto = ?
         WHERE Email = ?`,
        [buffer, email]
    );


    res.json({ message: 'Profile photo uploaded successfully' });
});

/**
 * GET /user-profile/photo
 * Serve image BLOB with appropriate content-type
 */
app.get('/user-profile/photo', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).send('Missing email');

    // Use db.get (callback) to fetch the BLOB column
    db.get(
        `SELECT ProfilePhoto FROM tblUsers WHERE Email = ?`,
        [email],
        (err, row) => {
            if (err) {
                console.error('[GET /user-profile/photo] DB error:', err);
                return res.status(500).send('Database error');
            }
            // Check the correct property, ProfilePhoto
            if (!row || !row.ProfilePhoto) {
                return res.status(404).send('No profile image found');
            }

            // Serve the raw BLOB with the right header
            res.set('Content-Type', 'image/jpeg');
            res.send(row.ProfilePhoto);
        }
    );
});



app.listen(HTTP_PORT, () => {
    console.log('App listening on', HTTP_PORT)
})
