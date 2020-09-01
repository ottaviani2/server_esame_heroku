const express = require('express');
const app = express();
const bcrypt = require('bcryptjs');
const bodyparser = require('body-parser');
const cookieparser = require("cookie-parser");
const http = require('http');
const path = require('path');
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(bodyparser.json());
app.use(cookieparser());
app.use(express.static(path.join(__dirname, 'public')));

//LOGIN
const cookies = new Map();

//LOIGN CON COOKIES
function attemptAuth(req){
    if(req.cookies.auth){
        if(cookies.has(req.cookies.auth)){
            const user = JSON.stringify(cookies.get(req.cookies.auth));
            console.log("Utente "+ user +" loggato via cookie");
            return true;
        }
        return false;
    }
}

//MySQL
/*
var mysql = require('mysql');
var con = mysql.createConnection({
      host: 'localhost',
	  user: 'root',
	  password: '',
	  database: 'serra'
});
con.connect((error) => {
    if(!error)
        console.log("Connected!")
    else
        console.log("Connection Error")   
});
*/

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get('/db', async (req, res) => {
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM test_table');
      const results = { 'results': (result) ? result.rows : null};
      res.set('content-type', 'application/json');
      res.send(results).end();
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })

app.get('/users', async (req, res) => {
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT mail FROM utenti');
        const results = { 'results': (result) ? result.rows : null};
        res.set('content-type', 'application/json');
        res.send(results).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
})

app.post('/users', async (req, res) => {
    try{
        if(!req.accepts('application/json')) {
            res.sendStatus(406);
            return;
        }
        console.log("richiesta inserimento nuovo utente "+ req.body.name);
        const salt = await bcrypt.genSalt();
        const sessionId = await bcrypt.hash(req.body.password, salt);
        try {
            const client = await pool.connect();
            const result = await client.query("INSERT INTO utenti(mail, salt, password) VALUES ('"+req.body.name+"', '"+salt+"', '"+sessionId+"')");
            res.status(200).send();
            client.release();
        } catch (err) {
            console.error(err);
            res.status(403).send()
        }
    } catch {
        res.status(403).send()
    }
})

app.post('/users/login', async (req, res) => {
    if(!req.accepts('application/json')) {
        res.sendStatus(406).end();
        return;
    }

    const username = req.body.name;
    const password = req.body.password;

    //genera il codice cookie
    const salt_s = await bcrypt.genSalt();
    const sessionId = await bcrypt.hash(password, salt_s);

    console.log("richiesta login "+username);

    try {
        const client = await pool.connect();
        const result = await client.query("SELECT salt FROM utenti WHERE mail = '"+username+"'");
        console.log(result.rows[0].salt);
        const salt = result.rows[0].salt;
        const pass = await bcrypt.hash(password, salt);
        const result_1 = await client.query("SELECT mail FROM utenti WHERE mail = '"+username+"' AND password = '"+pass+"'");
        cookies.set(sessionId,{ mail: result_1.rows[0].mail});
        res.cookie('auth', sessionId);
        res.status(200).send('You are logged in').end() 
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//OPERAZIONI CRUD
//CREATE
app.post('/pianta', async (req, res) => {
    const id = req.body.id;
    const clima = req.body.clima;    
    const nome = req.body.name;
    const latin = req.body.latin;

    console.log("Recieve Post request for Pianta, name: "+nome);

	if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }
    try {
        const client = await pool.connect();
        const result = await client.query("INSERT INTO tipo_pianta(Codice_tipo,Fascia_climatica, Nome_latino, Nome_comune) VALUES ('"+id+"','"+clima+"','"+latin+"','"+nome+"')");
        res.set('content-type', 'application/json');
        res.sendStatus(200).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//READ
app.get('/pianta', async (req, res) => {
	if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }

    const nome = req.body.name;

    console.log(req.headers);
	console.log("Recieve Get request for Pianta, name: "+nome);
    
	try {
        const client = await pool.connect();
        const result = await client.query("SELECT Lotto, ubicazione.Descrizione, Quantita, lotto.Data_arrivo, lotto.Prezzo_vendita FROM pianta_ubicata JOIN lotto ON pianta_ubicata.Lotto = lotto.Codice_lotto JOIN tipo_pianta ON tipo_pianta.Codice_tipo = lotto.Tipo_pianta JOIN ubicazione ON pianta_ubicata.Ubicazione = ubicazione.Codice_ubicazione WHERE tipo_pianta.Nome_comune = '"+nome+"' OR tipo_pianta.Nome_latino = '"+nome+"'");
        res.set('content-type', 'application/json');
        res.send(result.rows).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//UPDATE
app.put('/pianta/c_name', async (req, res) => {
	if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }

    const nome = req.body.name;
    const newname = req.body.newname;

    console.log("Recieve Put request for Pianta, name: "+nome);
    try {
        const client = await pool.connect();
        const result = await client.query("UPDATE tipo_pianta SET Nome_comune='"+newname+"' WHERE Nome_comune ='"+nome+"'");
        res.set('content-type', 'application/json');
        res.sendStatus(200).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//DELETE
app.delete('/pianta', async (req, res) => {
	if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }

    const nome = req.body.name;

    console.log("Recieve Post request for Pianta, name: "+nome);
    try {
        const client = await pool.connect();
        const result = await client.query("DELETE FROM tipo_pianta  WHERE Nome_comune ='"+nome+"' OR Nome_latino = '"+nome+"'");
        res.set('content-type', 'application/json');
        res.sendStatus(200).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});


//RICHIESTA ESTERNA OPENWEATHERMAP
app.get('/weather', async (req, res) => {
    if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }
    try{
    const city = req.body.city;
    var resp = '';
        
    const options = {
        host: 'api.openweathermap.org',
        path: '/data/2.5/weather?q='+city+',it&appid=7ad91403d31e02346838138e8f0506f3&units=metric',
    };
        
    callback = function(response) {

        response.on('data', function (chunk) {
        resp += chunk;
    });
      
    //the whole response has been received, so we just print it out here
    response.on('end', function () {
        res.set('content-type', 'application/json');
        res.send(resp).end();
        console.log(resp);
    });
    }
      
    http.request(options, callback).end();
    }catch{
        res.sendStatus(401).end();
    }
})

//caricare la porta dalle variabili di ambiente di Heroku process.env.PORT
app.listen(process.env.PORT, ()=>console.log("Express server is running"))