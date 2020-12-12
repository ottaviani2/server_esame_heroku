const express = require('express');
const app = express();
const bcrypt = require('bcryptjs');
const bodyparser = require('body-parser');
const cookieparser = require("cookie-parser");
const http = require('http');
const path = require('path');
const fs = require('fs');


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

//CARRELLO
const cart = new Map();

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


//CARRELLO
function shopping(req){
    if(req.params.shopping_id){
        if(cart.has(req.params.shopping_id)){
            const user = JSON.stringify(cookies.get(req.cart.mail));
            console.log("Utente "+ user +" accede a carrello");
            return true;
        }
        return false;
    }
}


class RequestHandler {
    constructor(request, response) {
        this.req = request;
        this.res = response;
    }
    handle(path, method, cb) {
        let self = this;
        if (this.req.url === path && this.req.method === method) {
            cb(self.req, self.res);
        }
    }
}


//Sviluppare RESTFULL


//MySQL
/*
const mysql = require('mysql');
var con = mysql.createConnection({
      host: '89.40.173.81',
	  user: 'fiqoaque_admin',
	  password: 'Greghi_girasoli_90',
	  database: 'fiqoaque_serra'
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

app.get('/', (req,res) => {
    let home = fs.readFileSync('./vivaio/index.php').toString();
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.end(home);
})

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

app.get('/users/all', async (req, res) => {
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
    const salt_c = await bcrypt.genSalt();
    const sessionId = await bcrypt.hash(salt_c, salt_s);

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
app.post('/pianta/new', async (req, res) => {
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
        res.sendStatus(201).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//READ
app.get('/pianta/:name', async (req, res) => {
	/*if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }*/
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }

    const nome = req.params.name;

    console.log(req.headers);
	console.log("Recieve Get request for Pianta, name: "+nome);
    
	try {
        const client = await pool.connect();
        const result = await client.query("SELECT Lotto, ubicazione.Descrizione, Quantita, lotto.Data_arrivo, lotto.Prezzo_vendita FROM pianta_ubicata JOIN lotto ON pianta_ubicata.Lotto = lotto.Codice_lotto JOIN tipo_pianta ON tipo_pianta.Codice_tipo = lotto.Tipo_pianta JOIN ubicazione ON pianta_ubicata.Ubicazione = ubicazione.Codice_ubicazione WHERE tipo_pianta.Nome_comune = '"+nome+"' OR tipo_pianta.Nome_latino = '"+nome+"'");
        //res.set('content-type', 'application/json');
        res.send(result.rows).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//UPDATE
app.put('/pianta/c_name/:name', async (req, res) => {
	if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }

    const name = req.params.name;
    const newname = req.body.newname;

    console.log("Recieve Put request for Pianta, name: "+nome);
    try {
        const client = await pool.connect();
        const result = await client.query("UPDATE tipo_pianta SET Nome_comune='"+newname+"' WHERE Nome_comune ='"+name+"'");
        res.set('content-type', 'application/json');
        res.sendStatus(200).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});

//Controlla modifiche
//DELETE
app.delete('/pianta/:name', async (req, res) => {
	/*if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }*/
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }

    const nome = req.params.name;

    console.log("Recieve Post request for Pianta, name: "+nome);
    try {
        const client = await pool.connect();
        const result = await client.query("DELETE FROM tipo_pianta  WHERE Nome_latino = '"+nome+"'");
        //res.set('content-type', 'application/json');
        res.sendStatus(200).end();
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send()
    }
});


//RICHIESTA ESTERNA OPENWEATHERMAP
app.get('/weather/:city', async (req, res) => {
    /*if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }*/
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }
    try{
    const city = req.params.city;
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

app.get('/cart/start/:client', async (req, res) => {
    /*if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }*/
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }
try{
    const id_client = req.params.client;
    const user = cookies.get(req.cookies.auth);
    
    const client = await pool.connect();
    const result = await client.query("INSERT INTO shopping_session(id_utente, id_cliente) VALUES ('"+user+"','"+id_client+"')");
    const result1 = await client.query("SELECT id FROM shopping_session WHERE id_utente = '"+user+"' AND id_cliente = '"+id_client+"'");
    const id_shopping = result1.rows[0].id;
    cart.set(id_shopping ,{mail: user});
    console.log("insert: "+id_shopping);
    res.set('content-type', 'application/json');
    res.send('{"shopping_id": "'+id_shopping+'"}').end();
    client.release();
} catch (err) {
    console.error(err);
    res.status(403).send();
}
})

app.get('/cart/:shopping_id', async (req, res) => {
    /*if(!req.accepts('application/json')) {
		res.sendStatus(406).end();
		return;
    }*/
    if(!attemptAuth(req)) {
		res.sendStatus(401).end();
		return;
    }
    console.log(req.params.shopping_id);

    if(!shopping(req)){
        res.sendStatus(401).end();
        return;
    }

    const cod_tipo = req.body.cod_tipo;
    const number = req.body.number;
    const shopping_id = req.params.shopping_id;

    try {
        const client = await pool.connect();
        const result1 = await client.query("INSERT INTO cart(id_shopping, codice_tipo, quantità) VALUES ('"+shopping_id+"','"+cod_tipo+"',"+number+")");
        res.status(200).send(result1).end(); 
        client.release();
    } catch (err) {
        console.error(err);
        res.status(403).send();
    }
})



//caricare la porta dalle variabili di ambiente di Heroku process.env.PORT
app.listen(process.env.PORT, ()=>console.log("Express server is running"))