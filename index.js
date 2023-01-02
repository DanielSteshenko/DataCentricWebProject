// Import the express module and create an express app
const express = require('express');
const app = express();
const port = 3000;

// Import the body-parser module and use it to parse JSON data
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import the express-validator module and use it to validate data
const { check, validationResult } = require('express-validator');

// Import the cors module and use it to allow cross-origin requests
const cors = require('cors');
app.use(cors());

// Set up MongoDB connection
const mongoose = require('mongoose');
mongoose.set('strictQuery', true); // The terminal was complaining about this, so I added it
const mongoURL =
  'mongodb+srv://daniel:XsYFZilf5uUb33Lw@cluster0.bbi9ncr.mongodb.net/?retryWrites=true&w=majority';
// Connect to MongoDB
mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });

// MongoDB connection and check for errors
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Create a new database and schema for employees
let employeesDB = db.useDb('employeesDB');
const employeesSchema = new mongoose.Schema({
  _id: String,
  phone: String,
  email: String,
});
const Employees = employeesDB.model('employees', employeesSchema);

// Set up the view engine
app.set('view engine', 'ejs');

// Set up the MySQL connection (You will need to change the user, host, port, password, and database to match your MySQL database as it is currently set up for my database)
const mysql = require('promise-mysql');
mysql
  .createPool({
    user: 'root',
    host: 'localhost',
    port: 3306,
    password: '',
    database: 'proj2022',
  })
  .then((p) => {
    pool = p;
  })
  .catch((e) => {
    console.log(e);
  });

// Start the server (We are doing this here so that the server only starts after the database connection is established)
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// GET / (Home Page)
app.get('/', (req, res) => {
  res.render('home');
});

// GET /employees (Page displaying all employees from the MySQL database)
app.get('/employees', (req, res) => {
  const sql = 'SELECT * FROM employee';
  pool
    .query(sql, (err, results) => {
      if (err) throw err;
      res.render('employees', { employees: results });
    })
    .catch((err) => {
      console.log(err);
      res.redirect('/'); // Redirect to home page if there is an error
    });
});

// GET /employees/edit/:eid (Page for editing an employee)
app.get('/employees/edit/:eid', (req, res) => {
  const sql = 'SELECT * FROM employee WHERE eid = ?';
  pool
    .query(sql, [req.params.eid], (err, results) => {
      if (err) throw err;
      res.render('employee', { employee: results[0], errors: undefined });
    })
    .catch((err) => {
      console.log(err);
      res.redirect('/employees');
    });
});

// POST /employees/edit/:eid (Handle the form submission for editing an employee)
app.post(
  '/employees/edit/:eid',
  [
    check('ename')
      .isLength({ min: 5 })
      .withMessage('Name must be at least 5 characters long'), // If the name is less than 5 characters long, return an error
  ],
  [
    check('salary')
      .isFloat({ min: 0 })
      .withMessage('Salary must be a positive number'), // If the salary is less than 0, return an error
  ],
  [
    check('role')
      .isIn(['Manager', 'Employee'])
      .withMessage('Role must be Manager or Employee'), // If the role is not Manager or Employee, return an error
  ],
  (req, res) => {
    // Create an object to store the data from the form, as you might need to re-render the form if there are errors
    let givenData = {};
    givenData.eid = req.params.eid;
    givenData.ename = req.body.ename;
    givenData.salary = req.body.salary;
    givenData.role = req.body.role;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('employee', { employee: givenData, errors: errors.errors }); // If there are errors, re-render the form with the errors
    } else {
      // If there are no errors, update the employee in the database
      const sql =
        'UPDATE employee SET ename = ?, salary = ?, role = ? WHERE eid = ?';
      pool
        .query(sql, [
          givenData.ename,
          givenData.salary,
          givenData.role,
          givenData.eid,
        ])
        .then(() => {
          res.redirect('/employees'); // Redirect to the employees page
        })
        .catch((err) => {
          console.log(err);
          res.redirect('/employees'); // Redirect to the employees page if there is an error
        });
    }
  }
);

// GET /depts
// The Departments page:
// • Shows each department ID, name, budget and county the Department is in.
// • Has a Delete action for each Department.
// • Has a link back to the GET / (Home Page) page.
app.get('/depts', (req, res) => {
  // Query the database for all departments, and get the county for each department from the location table
  pool
    .query(
      'SELECT dept.did, dept.dname, dept.budget, location.county FROM dept INNER JOIN location ON location.lid = dept.lid',
      (err, results) => {
        if (err) throw err;
        res.render('depts', { depts: results }); // Render the depts page with the results
      }
    )
    .catch((err) => {
      console.log(err);
      res.redirect('/'); // Redirect to home page if there is an error
    });
});

// GET /depts/delete/:did
app.get('/depts/delete/:did', (req, res) => {
  // Delete the department with the given ID
  pool
    .query('DELETE FROM dept WHERE did = ?', [req.params.did])
    .then(() => {
      res.redirect('/depts'); // Redirect to the departments page
    })
    .catch((err) => {
      res.send(`<div>
                <h1>Error Messages</h1>
                <h2>${req.params.did} has Employees and cannot be deleted</h2>
                <a href="/">Home</a>
                </div>`); // If there is an error, display an error message
    });
});

// GET /employeesMongoDB
app.get('/employeesMongoDB', (req, res) => {
  Employees.find({}, (err, results) => {
    if (err) throw err;
    res.render('employeesMongoDB', { employees: results }); // Render the employeesMongoDB page with the results
  });
});

// GET /employeesMongoDB/add
app.get('/employeesMongoDB/add', (req, res) => {
  res.render('employeesMongoDB/add', { errors: undefined }); // Render the employeesMongoDB/add page with no errors
});

// POST /employeesMongoDB/add
// The following conditions must be checked:
// • EID must be 4 characters:
// • Phone must be >5 characters.
// • Email must be a valid email address.

app.post(
  '/employeesMongoDB/add',
  [
    check('_id').isLength({ eq: 4 }).withMessage('EID must be 4 characters'), // Check if EID is 4 characters
  ],
  [
    check('phone')
      .isLength({ min: 5 })
      .withMessage('Phone must be >5 characters'), // Check if phone is >5 characters
  ],
  [
    check('email').isEmail().withMessage('Email must be a valid email address'), // Check if email is a valid email address
  ],
  async (req, res) => {
    // Check if there are any errors
    const errors = validationResult(req);

    // If there are errors, re-render the form with the errors
    if (!errors.isEmpty()) {
      res.render('employeesMongoDB/add', { errors: errors.errors }); // If there are errors, re-render the form with the errors
    } else {
      // Check if data exists in mongodb already
      let exists = await Employees.findOne({ _id: req.body._id });

      // If the data exists, display an error message
      if (exists) {
        res.send(`<div>
        <h1>Error Message</h1>
            <h2>Error: ${req.body._id} already exists in MongoDB</h2>
            <a href="/employeesMongoDB">Home</a>
        </div>`);
        return; // If there are errors, re-render the form with the errors
      } else {
        // Check if data exists in mysql already
        let sql = 'SELECT * FROM employee WHERE eid = ?';
        sql = await pool.query(sql, [req.body._id]);

        if (sql.length == 0) {
          res.send(`<div>
            <h1>Error Message</h1>
            <h2>Error: ${req.body._id} does not exist in MySQL</h2>
            <a href="/employeesMongoDB">Home</a>
        </div>`);
          return;
        } else {
          // Insert the data into mongodb
          Employees.insertMany([
            {
              _id: req.body._id,
              phone: req.body.phone,
              email: req.body.email,
            },
          ]);
          res.redirect('/employeesMongoDB'); // Redirect to the employeesMongoDB page
        }
      }
    }
  }
);

// Additional for more marks

// GET /addEmployees
app.get('/addEmployees', (req, res) => {
  // Return all employees from MySQL and MongoDB
  let sql = 'SELECT * FROM employee';
  pool.query(sql, (err, results) => {
    if (err) throw err;
    res.render('addEmployees', {
      employees: results, // Render the addEmployees page with the results
    });
  });
});

// GET /addNewEmployee
app.get('/addNewEmployee', (req, res) => {
  // Return a form to add a new employee
  res.send(`<div>
        <h1>Employee</h1>
        <form action="/addNewEmployee" method="POST">
            <label for="eid">EID</label>
            <input type="text" name="eid" id="eid">
            <label for="ename">Ename</label>
            <input type="text" name="ename" id="ename">
            <label for="salary">Salary</label>
            <input type="text" name="salary" id="salary">
            <label for="role">Role</label>
            <select id="role" name="role">
                <option value="Manager">Manager</option>
                <option value="Employee">Employee</option>
            </select>
            <labal for="did">Department</labal>
            <select id="did" name="did">
                <option value="SAL">SAL</option>
                <option value="OPS">OPS</option>
                <option value="R&D">R&D</option>
                <option value="HR">HR</option>
            </select>

            <button type="submit">Add</button>
        </form>
        </div>`);
});

// POST /addNewEmployee || Innovation ||
app.post(
  '/addNewEmployee',
  [
    check('eid').isLength({ eq: 4 }).withMessage('EID must be 4 characters'), // Check if EID is 4 characters
  ],
  [
    check('ename')
      .isLength({ min: 5 })
      .withMessage('Name must be at least 5 characters long'), // Check if name is >5 characters
  ],
  [
    check('salary')
      .isFloat({ min: 0 })
      .withMessage('Salary must be a positive number'), // Check if salary is a positive number
  ],
  [
    check('role')
      .isIn(['Manager', 'Employee'])
      .withMessage('Role must be Manager or Employee'), // Check if role is Manager or Employee
  ],
  [
    check('did')
      .isIn(['SAL', 'OPS', 'R&D', 'HR'])
      .withMessage('Department must be SAL, OPS, R&D or HR'), // Check if department is SAL, OPS, R&D or HR
  ],
  async (req, res) => {
    // Check if there are any errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.send(`<div>
                <h1>Error Message</h1>
                <h2>${errors.errors[0].msg}</h2>
                <a href="/addEmployees">Home</a>
            </div>`);
      return;
    } else {
      // Insert details into employee table and empt_dept table
      let sql = `INSERT INTO employee (eid, ename, salary, role) VALUES (?, ?, ?, ?)`;
      sql = await pool
        .query(sql, [
          req.body.eid,
          req.body.ename,
          req.body.salary,
          req.body.role,
        ])
        .catch((err) => {
          console.log(err);
        });

      // Insert details into empt_dept table
      sql = `INSERT INTO emp_dept (eid, did) VALUES (?, ?)`;
      sql = await pool.query(sql, [req.body.eid, req.body.did]).catch((err) => {
        console.log(err); // If there are errors, re-render the form with the errors
      });

      // Redirect to the addEmployees page
      res.redirect('/addEmployees');
    }
  }
);
