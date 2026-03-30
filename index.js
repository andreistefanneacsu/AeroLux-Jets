const express = require("express");
const path = require("path");

const app = express();

app.use("/resurse", express.static(path.join(__dirname, "resurse")));

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/cale", function (req, res) {
    res.send("Raspuns pentru ruta /cale");
});

app.listen(8080, () => {
    console.log("Serverul a pornit pe portul 8080!");
});