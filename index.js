const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 8080;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

console.log("Director proiect (__dirname):", __dirname);
console.log("Cale fișier curent (__filename):", __filename);
console.log("Director de lucru (process.cwd()):", process.cwd());

const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];
vect_foldere.forEach(folder => {
    const folderPath = path.join(__dirname, folder);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log(`Folder creat: ${folder}`);
    }
});


let obGlobal = { obErori: null };

function initErori() {
    const eroriPath = path.join(__dirname, "resurse", "json", "erori.json");
    
    if (!fs.existsSync(eroriPath)) {
        console.error("EROARE CRITICĂ: Fișierul erori.json nu există la calea specificată!");
        process.exit(1);
    }

    const eroriString = fs.readFileSync(eroriPath, 'utf8');

    const fragmenteJson = eroriString.split(/[{}]/);
    for (let fragment of fragmenteJson) {
        const regexChei = /"([^"]+)"\s*:/g;
        let potriviri = [...fragment.matchAll(regexChei)].map(m => m[1]);
        
        let cheiUnice = new Set(potriviri);
        if (potriviri.length !== cheiUnice.size) {
            console.error("EROARE JSON (STRING): S-a detectat o proprietate specificată de mai multe ori în același obiect!");
            process.exit(1);
        }
    }

    let errData;
    try {
        errData = JSON.parse(eroriString);
    } catch (e) {
        console.error("EROARE CRITICĂ: erori.json nu este un JSON valid sintactic!", e);
        process.exit(1);
    }

    if (!errData.info_erori || !errData.cale_baza || !errData.eroare_default) {
        console.error("EROARE CRITICĂ: Lipsesc proprietăți de bază (info_erori, cale_baza, eroare_default) din JSON!");
        process.exit(1);
    }

    if (!errData.eroare_default.titlu || !errData.eroare_default.text || !errData.eroare_default.imagine) {
        console.error("EROARE CRITICĂ: Proprietăți lipsă în eroare_default (titlu, text sau imagine)!");
        process.exit(1);
    }

    const folderCaleBaza = path.join(__dirname, errData.cale_baza);
    if (!fs.existsSync(folderCaleBaza)) {
        console.error(`EROARE CRITICĂ: Folderul specificat în cale_baza (${errData.cale_baza}) nu există pe disc!`);
        process.exit(1);
    }

    const imgDefaultPath = path.join(folderCaleBaza, errData.eroare_default.imagine);
    if (!fs.existsSync(imgDefaultPath)) {
        console.error(`EROARE CRITICĂ: Imaginea default (${errData.eroare_default.imagine}) nu există fizic în folder!`);
        process.exit(1);
    }

    errData.eroare_default.imagine = "/" + path.join(errData.cale_baza, errData.eroare_default.imagine).replace(/\\/g, '/');

    const idMap = new Map();
    
    errData.info_erori.forEach(err => {
        if (idMap.has(err.identificator)) {
            console.error(`EROARE: S-au găsit multiple erori cu același identificator: ${err.identificator}!`);
            
            let errDuplicat1 = { ...idMap.get(err.identificator) }; delete errDuplicat1.identificator;
            let errDuplicat2 = { ...err }; delete errDuplicat2.identificator;
            
            console.error(" -> Proprietățile primei erori:", errDuplicat1);
            console.error(" -> Proprietățile celei de-a doua erori:", errDuplicat2);
        } else {
            idMap.set(err.identificator, err);
        }

        let imgPath = path.join(folderCaleBaza, err.imagine);
        if (!fs.existsSync(imgPath)) {
            console.error(`EROARE CRITICĂ: Imaginea (${err.imagine}) pentru eroarea ${err.identificator} nu există fizic în folder!`);
            process.exit(1);
        }
        
        err.imagine = "/" + path.join(errData.cale_baza, err.imagine).replace(/\\/g, '/');
    });

    obGlobal.obErori = errData;
    console.log("Fișierul erori.json a fost validat și încărcat cu succes (Bonus complet)!");
}

initErori();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let errJson = obGlobal.obErori.info_erori.find(e => e.identificator == identificator);
    let errDefault = obGlobal.obErori.eroare_default;

    let titluFinal = titlu || (errJson ? errJson.titlu : errDefault.titlu);
    let textFinal = text || (errJson ? errJson.text : errDefault.text);
    let imagineFinal = imagine || (errJson ? errJson.imagine : errDefault.imagine);

    res.status(identificator || 500).render("pagini/eroare", {
        titlu: titluFinal,
        text: textFinal,
        imagine: imagineFinal
    });
}

app.use("/resurse", (req, res, next) => {
    const extensie = path.extname(req.url);
    if (!extensie || req.url.endsWith("/")) {
        return afisareEroare(res, 403);
    }
    next();
});

app.use("/resurse", express.static(path.join(__dirname, "resurse")));

app.get(/\.ejs$/, (req, res) => {
    afisareEroare(res, 400);
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(__dirname, "resurse/imagini/favicon/favicon.ico"));
});

app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index', { ip: req.ip });
});

app.get(/(.*)/, (req, res) => {
    let pagina = req.params[0];

    if (pagina === "/" || pagina === "") {
        pagina = "/index";
    }

    if (!pagina.startsWith("/")) {
        pagina = "/" + pagina;
    }

    if (pagina.includes('.') && !pagina.endsWith('.ejs')) {
        return afisareEroare(res, 404);
    }

    res.render('pagini' + pagina, { ip: req.ip }, function(err, html) {
        if (err) {
            if (err.message.startsWith("Failed to lookup view")) {
                return afisareEroare(res, 404);
            }
            console.error("Eroare randare:", err);
            return afisareEroare(res, 500, "Eroare Server", "A apărut o eroare la procesarea paginii.");
        }
        res.send(html);
    });
});

app.use(express.urlencoded({ extended: true }));

app.post("/trimite-mesaj", (req, res) => {
    const nume = req.body.nume;
    const email = req.body.email;
    const subiect = req.body.subiect;
    const mesaj = req.body.mesaj;

    console.log("--- MESAJ NOU PRIMIT ---");
    console.log(`De la: ${nume} (${email})`);
    console.log(`Subiect: ${subiect}`);
    console.log(`Mesaj: ${mesaj}`);
    console.log("------------------------");

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #d4af37;">Mesaj Trimis cu Succes!</h1>
            <p>Mulțumim, <strong>${nume}</strong>. Te vom contacta în curând la adresa ${email}.</p>
            <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #0a192f; color: white; text-decoration: none; border-radius: 5px;">Întoarce-te pe site</a>
        </div>
    `);
});

app.listen(port, () => {
    console.log(`Serverul rulează la: http://localhost:${port}`);
});