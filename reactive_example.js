const express = require("express");
// const nunjucks = require("nunjucks");
const mongodb = require("mongodb");
const expressWs = require("express-ws");
const {MONGODB} = require("./credentials");


const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`;
const client = new mongodb.MongoClient(uri);
const app = express();
const port = 3000;


app.set('view engine', 'pug');
app.set('views', './views');
app.locals.basedir = app.get('views');


// Register Websocket
const ws_app = expressWs(app);

// Connect and watch DB
async function watchDB() {
    await client.connect();
    const col = await client.db("express").collection("reactiveVars");
    return col.watch({fullDocument: "updateLookup"})
}


// Register Nunjucks
// nunjucks.configure("views", {
//     autoescape: true,
//     express: app,
//     noCache: true
// });

// Bodyparser and Static
app.use(express.urlencoded({extended: true}));
app.use("/public", express.static(__dirname + "/public"));

// Routes
//Websocket
app.ws("/reactivity", async (ws, req) => {
    console.log("Web Socket opened");
    await client.connect();
    const col = client.db("express").collection("reactiveVars");

    const aWss = ws_app.getWss("/reactivity");

    // Relay updates from MongoDB to clients
    watchDB().then(stream => {
        stream.on("change", changeEvent => {
            console.log("MongoDB has changed: ", changeEvent);
            aWss.clients.forEach(function (client) {
                let response = {
                    "varName": changeEvent.fullDocument["varName"],
                    "value": changeEvent.fullDocument["value"]
                };
                client.send(JSON.stringify(response));
            })
        })
    });

    // Handle variable update from clients
    ws.on("message", async (msg) => {
        console.log("Received from browser: ", msg);
        let updateDoc = {
            $set: JSON.parse(msg)
        };
        console.log("Update Doc: ", updateDoc);
        let queryDoc = {
            "varName": JSON.parse(msg).varName
        };
        const result = await col.findOneAndUpdate(
            queryDoc,
            updateDoc,
            {upsert: true}
        );
        console.log("Updated MongoDB: ", result);
    });
});

// HTTP
app.get("/", async (req, res) => {
    await client.connect();
    const col = client.db("reactiveVars").collection("reactiveVars");
    let cursor = col.find({});
    const allVariables = await cursor.toArray();

    res.render(
        "reactivityExample",
        {reactiveVariables: allVariables}
        )
});

app.listen(port, () => {
    console.log(`App listening on port http://localhost:${port}`);
});
