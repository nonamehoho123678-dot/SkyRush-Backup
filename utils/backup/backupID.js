const fs = require("fs");
const path = require("path");

const backupFolder = path.join(
    __dirname,
    "..",
    "..",
    "backups"
);

function getTodayString() {

    const now = new Date();

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const year = now.getFullYear();

    return `${day}-${month}-${year}`;
}


function generateBackupID() {

    if (!fs.existsSync(backupFolder)) {

        fs.mkdirSync(
            backupFolder,
            {
                recursive: true
            }
        );

    }


    const today =
        getTodayString();

    const prefix =
        `SR-${today}-`;


    const files =
        fs.readdirSync(
            backupFolder
        )
        .filter(
            file =>
                file.endsWith(".json")
        );


    let maxNumber = 0;


    for (const file of files) {

        const name =
            file.slice(
                0,
                -5
            );


        if (
            !name.startsWith(prefix)
        ) {

            continue;

        }


        const number =
            Number(
                name.slice(
                    prefix.length
                )
            );


        if (
            Number.isInteger(number) &&
            number > maxNumber
        ) {

            maxNumber = number;

        }

    }


    const nextNumber =
        maxNumber + 1;


    const numberString =
        String(
            nextNumber
        ).padStart(
            3,
            "0"
        );


    return `${prefix}${numberString}`;

}


module.exports =
    generateBackupID;