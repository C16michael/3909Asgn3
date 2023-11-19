const express = require("express");
const mongodb = require("mongodb");
const expressWs = require("express-ws");
const { MONGODB } = require("./credentials");

const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`;
const client = new mongodb.MongoClient(uri);
const app = express();
const port = 3000;

app.set('view engine', 'pug');
app.set('views', './views');
app.locals.basedir = app.get('views');

// Register Websocket
expressWs(app);

// Connect to MongoDB
async function connectToMongoDB() {
    await client.connect();
    console.log("Connected to MongoDB");
    return client.db("express").collection("reactiveVars");
}

// Websocket route
app.ws("/reactivity", async (ws, req) => {
    console.log("Web Socket opened");
    const col = await connectToMongoDB();

    ws.on("message", async (msg) => {
        const update = JSON.parse(msg);
        console.log("Received from browser: ", update);

        // Send immediate response back to the client
        ws.send(JSON.stringify({ status: "immediateResponse", varName: update.varName, value: update.value }));

        // Then update the MongoDB
        const queryDoc = { "varName": update.varName };
        const updateDoc = { $set: { "value": update.value } };
        await col.findOneAndUpdate(queryDoc, updateDoc, { upsert: true });

        // Send MongoDB update complete message
        ws.send(JSON.stringify({ status: "updateComplete", varName: update.varName, value: update.value }));
    });
});

// HTTP route
// HTTP route
app.get("/", async (req, res) => {
    const col = await connectToMongoDB();
    let cursor = col.find({}).sort({ varName: 1 });
    const allVariables = await cursor.toArray();

    res.render("reactivityExample", { reactiveVariables: allVariables });
});


app.listen(port, () => {
    console.log(`App listening on port http://localhost:${port}`);
});
