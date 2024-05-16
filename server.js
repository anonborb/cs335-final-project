process.stdin.setEncoding("utf8");
const express = require("express");
const path = require("path");
const app = express(); 

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') }) 

const uri = process.env.MONGO_CONNECTION_STRING;
const DB_NAME = "cmsc335_Final_Project"
const COLLECTION = "savedRecipes"
const APIKEY = process.env.APIKEY;

const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

// Command Line
if (process.argv.length != 3) {
    process.stdout.write(`Usage: server.js <portNumber>\n`);
    process.exit(1);
}

const portNumber = process.argv[2];
app.listen(portNumber);     // Starting server
process.stdout.write(`Webserver started and running at http://localhost:${portNumber}\n`);  

const prompt = "Type 'stop' to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
        const command = dataInput.trim();

        if (command === "stop") {        // stops server
            process.stdout.write("Shutting down the server\n");
            process.exit(1);

        } else {                                // invalid command
            process.stdout.write(`Invalid Command: ${command}\n`);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    }
});


// Request handling
app.use(express.urlencoded({ extended: false }));
app.use(express.static("templates"))

app.get("/", (request, response) => { 
    response.render("index");
});

app.get("/recipeForm", (request, response) => {
    response.render("recipeForm");
});

app.get("/randomRecipeGenerator", async (request, response) => {
    let exclude_tags = request.body.exclude_tags;
    exclude_tags = (exclude_tags === 'none') ? '' : exclude_tags;
    const apiRequest = `https://api.spoonacular.com/recipes/random?number=1&exclude-tags=${exclude_tags}&apiKey=${APIKEY}`
    try {
        const result = await fetch(apiRequest);
        const json = await result.json();
        const recipe = json.recipes[0];
        //console.log(json);
        const variables = {
            recipe_id: recipe.id,
            name: recipe.title,
            image: `<img src="${recipe.image}" alt="image of ${recipe.title}">`,
            source: recipe.sourceName,
            sourceUrl: `<a href="${recipe.sourceUrl}">${recipe.sourceUrl}</a>`
        }; 
        response.render("generateRandomRecipe", variables);
    } catch(e) {
        console.error(e)
    }
});

app.post("/saveRecipe/:recipe_id", async (request, response) => {
    const apiRequest = `https://api.spoonacular.com/recipes/${request.params.recipe_id}/information?includeNutrition=false&apiKey=${APIKEY}`
    const result = await fetch(apiRequest);
    const json = await result.json();
    //console.log(json);
    const recipe = { 
        recipe_id: json.id,
        name: json.title,
        image: `<img src="${json.image}" alt="image of ${json.title}">`,
        source: json.sourceName,
        sourceUrl: `<a href="${json.sourceUrl}">${json.sourceUrl}</a>`
    };

    // mongodb - inserting into mongodb database
    try {
        await client.connect();
        await client.db(DB_NAME).collection(COLLECTION).insertOne(recipe);
    } catch(e) {
        console.error(e)
    } finally{
        await client.close();
    }

    response.redirect("/savedRecipes");
});

app.get("/savedRecipes", async (request, response) => {
    let table = "";
    try {
        await client.connect();
        var result = await client.db(DB_NAME).collection(COLLECTION).find({});

        if (result) {
            table = "<table border='1'><thead><tr><th>Recipe Name</th><th>Image</th><th>Source Url</th><th></th></tr></thead><tbody>"
            for await (const doc of result) {
                table += `<tr><td>${doc.name}</td><td>${doc.image}</td><td>${doc.sourceUrl}</td><td>
                <form action='/deleteRecipe/${doc.recipe_id}' method="post"><input type="submit" value="Remove Recipe" class="button"></form></td></tr>`;
            }
            table += "</tbody></table>"
            
        } else {
            table = "Nothing Saved Yet!";
        }
    
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
    response.render("savedRecipes", { display: table });
});

app.post("/deleteRecipe/:recipe_id", async (request, response) => {
    const id = Number(request.params.recipe_id);
    try {
        //console.log(id);
        await client.connect();
        await client.db(DB_NAME).collection(COLLECTION).deleteOne({recipe_id: id});
    
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
    response.redirect("/savedRecipes");
});

app.post("/deleteAll", async (request, response) => {
    try {
        //console.log(id);
        await client.connect();
        await client.db(DB_NAME).collection(COLLECTION).deleteMany({});
    
    } catch(e) {
        console.error(e);
    } finally {
        await client.close();
    }
    response.redirect("/savedRecipes");
});

