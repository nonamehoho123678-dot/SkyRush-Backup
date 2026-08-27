const sqlite3 = require("sqlite3").verbose();
const path = require("path");


const db = new sqlite3.Database(

    path.join(
        __dirname,
        "../../database.sqlite"
    )

);



db.serialize(() => {


    db.run(`

        CREATE TABLE IF NOT EXISTS settings (

            guildId TEXT PRIMARY KEY,

            enabled INTEGER DEFAULT 0,

            interval INTEGER DEFAULT 60

        )

    `);


});



module.exports = db;