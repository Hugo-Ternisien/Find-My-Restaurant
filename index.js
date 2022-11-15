const express = require("express");
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const session = require('express-session')
const app = express();
const pool = dbConnection();
let userNumber = 0;
let listResto = null;
let addReviewLat = null;
let addReviewLon = null;
let nameR = null;


app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'secret code',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/')
  }
}


//routes
app.get('/home', isAuthenticated, (req, res) => {
  res.render('home')
});

app.get('/', (req, res) => {
  res.render('login')
});
 
app.get('/register',(req,res)=> {
  res.render('register')
});

app.get('/login', (req, res) => {
  res.render('login')
});


//Login
app.post('/login', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  let passwordHash = "";

  let sql = `SELECT * 
              FROM user
              WHERE username = ?`;
  let rows = await executeSQL(sql, [username]);
  if (rows.length > 0) { //username exists in database
    passwordHash = rows[0].password;
  }

  const match = await bcrypt.compare(password, passwordHash);

  if (match) {
    req.session.authenticated = true;
    res.render('home')
    for(var i = 0; i < rows.length; i += 1)
      {
        if (rows[i].username == username)
          userNumber = rows[i].userId;
      }
    console.log("___ User Number "+userNumber+" logged in ___"+ "\n");
    
    
  } else {
    res.render('login', { "error": "Wrong credentials" })
  }

});

//Register
app.post('/register', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let email = req.body.email;
  let rpassword = req.body.rpassword;

  let passwordHash = "";
  
  if(username!="" & password!="" && rpassword!="" && email!="")
  {
    if(password==rpassword)
    {
      let checkSQL = `SELECT *
              FROM user
              WHERE username = ?`;
      let check = await executeSQL(checkSQL, [username]);
      if (check.length == 0) 
      { 
        const saltRounds=10;
        let rows = [];
    
        bcrypt.genSalt(saltRounds, function(err, salt) {
            bcrypt.hash(password, salt, function(err, hash) {
              let sql = `INSERT INTO user
                         (username,mail,password)
                         VALUES (?,?,?)`;
              let params=[username, email, hash];
            
              rows = executeSQL(sql, params);
            });
          });
        res.render('login');
      } 
      else
      {
        res.render('register', { "error": "Username already taken!"})
      }
    }
    else
    {
      res.render('register', { "error": "Enter the same password!"})
    }
  }
  else 
  {
    res.render('register', { "error": "Please complete all the fields!"})
  }
});

app.get('/logout', (req, res) => {
  req.session.authenticated = false;
  req.session.destroy();
  res.redirect('/');
  userNumber = 0;
});

app.get('/account',isAuthenticated, async (req, res) => {
  let sql = `SELECT *
            FROM user
            WHERE userId = ${userNumber}`;
  let rows = await executeSQL(sql);
   res.render('account',{"user":rows});
});

app.get('/findResto',isAuthenticated, (req, res) => {
   res.render('findResto')
});

const options = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Host': 'mealme.p.rapidapi.com',
    'X-RapidAPI-Key': 'a383547ab9msh18967fdfb0f10adp1181eejsnfb76891c1e09'
  }
};

app.post('/resultResto', isAuthenticated, async (req, res) => {
  
  let city = req.body.city;
  let sort = req.body.sort;
  console.log("search resto in the city : "+city);
  if (city.toUpperCase() != "SEASIDE"){
    let urlcity=`https://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=4f3dac84297fb1564b74369d154a7ecf`;

  //let urlsearch = 'https://mealme.p.rapidapi.com/restaurants/details/menu?quote_id=eedf1965-3c65-4700-ac0a-a4022ba885af'
  
  let response1 = await fetch(urlcity);
  let datacity = await response1.json();
  let lat = datacity[0].lat;
  let lon=datacity[0].lon; 

  let urlresto = `https://mealme.p.rapidapi.com/restaurants/search/store?latitude=${lat}&longitude=${lon}&sort=${sort}`;

  
  let response = await fetch(urlresto,options)
	  .catch(err => console.error('error:' + err));
  let data = await response.json();

  listResto = data.restaurants;
  res.render('resultResto',{"resto":data.restaurants});
  }
  else
  {
    res.render('findResto');
  }
  

});

app.post('/addFav', isAuthenticated, async (req, res) => {
  
  let lat = req.body.lat;
  let lon = req.body.lon;
  let params=[userNumber,lat,lon];
  
  let check = `SELECT *
                  FROM favorite
                  WHERE (userId,latitude,longitude)=(?,?,?)`;
  let checkSQL = await executeSQL(check,params);
  if(checkSQL.length==0)
  {
    console.log("Restaurant added to favorite.")
    let sql = `INSERT INTO favorite
                     (userId,latitude,longitude)
                     VALUES (?,?,?)`;

    executeSQL(sql, params);
    res.redirect("/home");
  }else{
    res.redirect("/home");
  }

});

//Display Favorite
app.get('/displayFav', isAuthenticated, async (req, res) => {
  let sql = `SELECT DISTINCT * 
              FROM favorite
              WHERE userId = ${userNumber}`;

  let rows = await executeSQL(sql);
  let array=[];
  let data;

    for(let i=0;i<rows.length;i++)
      {
        let lat = rows[i].latitude;
        let lon = rows[i].longitude; 
      
        let urlresto = `https://mealme.p.rapidapi.com/restaurants/search/store?latitude=${lat}&longitude=${lon}&sort=distance`;
    
      let response = await fetch(urlresto,options);
        
      data = await response.json();
      array[i] = data.restaurants[0];
    }
  
  res.render('resultFav',{"resto":data, "array":array});
});


//Display your reviews
app.get('/displaypReview', isAuthenticated, async (req, res) => {
  let sql = `SELECT DISTINCT * 
              FROM review
              WHERE userId = ${userNumber}`;

  let rows = await executeSQL(sql);
  
  res.render('resultpReview',{"rows":rows});
});

app.get('/updateUser',isAuthenticated, async (req, res) => {
  let sql = `SELECT *
            FROM user
            WHERE userId = ${userNumber}`;
  let rows = await executeSQL(sql);
  console.log("Updating user ...");
  res.render('updateUser',{"user":rows});
});

app.post('/updateUser',isAuthenticated, async (req, res) => {
  let UMail = req.body.usermail;
  let UPassword = req.body.password;
  /*let checkSQL = `SELECT * 
              FROM user
              WHERE username = ?`;
  let check = await executeSQL(checkSQL, [UName]);
  if (check.length == 0){*/
    let passwordHash = "";
    const saltRounds=10;
    bcrypt.genSalt(saltRounds, function(err, salt) {
        bcrypt.hash(UPassword, salt, function(err, hash) {
          let sql = `UPDATE user
                     SET
                        mail  = ?,
                        password = ?
                     WHERE
                        userId  = ${userNumber}`;
          let params = [UMail, hash]
          rows = executeSQL(sql, params);
          console.log("User Updated."+"\n");
          
        });
      });
   res.render('home');
  /*}
  else {
    res.render('updateUser', { "error": "Username already taken!" });
  }*/
});

app.get('/deleteAccount',isAuthenticated, async (req, res) => { 
   let sql = `DELETE FROM user
              WHERE userId = ${userNumber}`;
   let rows = await executeSQL(sql);
   sql = `DELETE FROM favorite
          WHERE userId = ${userNumber}`
   rows = await executeSQL(sql);
   userNumber = 0;
   console.log("ACCOUNT DELETED."+"\n");
   req.session.authenticated = false;
   req.session.destroy();
   res.redirect('/');
});

app.get('/inDepthResto', isAuthenticated, async (req,res) => {
  let restoId = req.query.id;
  res.render('inDepthResto',{"resto":listResto[restoId]});
});

app.get('/inDepthReview', isAuthenticated, async (req,res) => {
  
  let restoName= req.query.restoName;
  console.log(restoName);
  let sql = `SELECT * 
              FROM review
              WHERE name = (?)`;
  params = [restoName];
  let rows = await executeSQL(sql,params);

  
  res.render('inDepthReview',{"rows":rows});
});

app.get('/addReview', isAuthenticated, async (req, res) => {
  let Id = req.query.id;
  addReviewLat = req.query.lat;
  addReviewLon = req.query.lon;
  let urlresto = `https://mealme.p.rapidapi.com/restaurants/search/store?latitude=${addReviewLat}&longitude=${addReviewLon}&sort=distance`;
    
      let response = await fetch(urlresto,options);
      
      let data = await response.json();
  console.log("Adding review to "+data.restaurants[0].name+"...");
  nameR = data.restaurants[0].name;
  res.render('addReview',{ "resto":listResto[Id]})
});


app.get('/sendReview', isAuthenticated, async (req, res) => {
  let title = req.query.title;
  let comment = req.query.comment;
  
  let params=[userNumber,nameR,addReviewLat,addReviewLon,title,comment];
  

    let sql = `INSERT INTO review
                     (userId,name,latitude,longitude, title, comment)
                     VALUES (?,?,?,?,?,?)`;

  executeSQL(sql, params);
  console.log("Review added to "+nameR+"."+"\n");
  res.render("home");

});



app.get("/dbTest", async function(req, res)
  {
    let sql = "SELECT CURDATE()";
    let rows = await executeSQL(sql);
    res.send(rows);
  });//dbTest

//functions
async function executeSQL(sql, params)
{
  return new Promise (function (resolve, reject) 
  {
    pool.query(sql, params, function (err, rows, fields) {
    if (err) throw err;
       resolve(rows);
    });
  });
}
//executeSQL
//values in red must be updated
function dbConnection(){

   const pool  = mysql.createPool({

      connectionLimit: 10,
      host: "bv2rebwf6zzsv341.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
      user: "gc72ye84m5yf2vat",
      password: "a6ku9vg4ue4nz2qx",
      database: "ay7pi0gpv7qkuqjt"
   }); 
   return pool;
} //dbConnection

//start server
app.listen(3000, () => {
console.log("Expresss server running...")
} )