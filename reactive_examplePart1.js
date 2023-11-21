// Cristiano Michael 3147571
//3.2 Part 3
const express = require("express");
const mongodb = require("mongodb");
const expressWs = require("express-ws");
const { MONGODB } = require("./credentials");

// MongoDB connection URI
const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`;
const client = new mongodb.MongoClient(uri);
const app = express();
const port = 3000;

// Set Pug as the view engine and define the views directory
app.set("view engine", "pug");
app.set("views", "./views");
app.locals.basedir = app.get("views");

// Register WebSocket with the Express app
expressWs(app);

// Function to connect to MongoDB and return the collection
async function connectToMongoDB() {
  await client.connect();
  console.log("Connected to MongoDB");
  return client.db("express").collection("reactiveVars");
}

// WebSocket route for handling real-time reactivity
app.ws("/reactivity", async (ws, req) => {
  console.log("WebSocket connection opened");
  const col = await connectToMongoDB();

  ws.on("message", async (msg) => {
    const update = JSON.parse(msg);
    console.log("Received update from browser: ", update);

    // Update the MongoDB collection
    const queryDoc = { varName: update.varName };
    const updateDoc = { $set: { value: update.value } };
    await col.findOneAndUpdate(queryDoc, updateDoc, { upsert: true });

    // Notify the client that the MongoDB update is complete
    ws.send(
      JSON.stringify({
        status: "updateComplete",
        varName: update.varName,
        value: update.value,
      })
    );
  });
});

// HTTP route to render the main page with reactive variables
app.get("/", async (req, res) => {
  const col = await connectToMongoDB();
  // Retrieve all variables from MongoDB, sorted by varName
  let cursor = col.find({}).sort({ varName: 1 });
  const allVariables = await cursor.toArray();

  // Render the page with the retrieved variables
  res.render("reactivityExamplePart1", { reactiveVariables: allVariables });
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`App listening on port http://localhost:${port}`);
});
