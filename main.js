import fs from "fs";
import path from "path";
import chardet from "chardet";

import { parse as parse1 } from "@node-steam/vdf";
import { parse as parse2 } from "vdf-parser";
import { parse as parse3 } from "kvparser";
import HTTPS from 'https'

const __dirname = path.resolve()
// const CONFIG = JSON.parse(fs.readFileSync("../../config.json", "utf-8"));
// const SOURCE_PATHS = CONFIG.SOURCE_PATHS;
const SOURCE_PATHS = path.join(__dirname,'original');
// const TARGET_FOLDER = CONFIG.TARGET_FOLDER;
const TARGET_FOLDER = path.join(__dirname,'parsed');
const IMAGES_FOLDER = path.join(__dirname,'images');
console.log(SOURCE_PATHS,)
console.log(TARGET_FOLDER,)
const PARSERS = [
    {
        name: "@node-steam/vdf",
        parse: parse1,
        output: path.join(TARGET_FOLDER, "@node-steam--vdf"),
    },
    // {
    //     name: "vdf-parser",
    //     parse: parse2,
    //     output: path.join(TARGET_FOLDER, "vdf-parser"),
    // },
    {
        name: "kvparser",
        parse: parse3,
        output: path.join(TARGET_FOLDER, "kvparser"),
    },
];

PARSERS.forEach((e,i)=>{
    if (!fs.existsSync(e.output)) {
        fs.mkdirSync(e.output, { recursive: true });
    }
})

function generateImagesCdn(){
    const filePath =path.join(IMAGES_FOLDER, "items_game_cdn.txt")
    const content = fs.readFileSync(filePath, { encoding: "utf-8" });
    const lines = content.split(/\r?\n/);
    let imagesCdn = {}
    // print all lines
    lines.forEach((line) => {
        if(line.startsWith('#')||!line){
            return
        }
        const kv = line.split('=')
        console.log(kv[1]);
        const re = /.*730\/icons\/([^.]*).*/.exec(kv[1])
        // console.log(re)
        imagesCdn[re[1]] = kv[1]
    });

    fs.writeFileSync(path.join(IMAGES_FOLDER, "images_cdn.json"), JSON.stringify(imagesCdn,(k,v)=>v,2));

}

function detectFileEncoding(filePath) {
    return chardet.detectFileSync(filePath);
}

function convertEncodingOfFile(file) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(SOURCE_PATHS, file);

        const fileEncoding = detectFileEncoding(filePath);

        if (fileEncoding !== "UTF-16LE") {
            console.log(
                `[Skipping conversion] File ${file} is not in UTF-16LE.`
            );
            return resolve();
        }

        try {
            // If it's UTF-16LE, then convert to UTF-8
            const content = fs.readFileSync(filePath, { encoding: "utf16le" });
            fs.writeFileSync(filePath, content, { encoding: "utf8" });
            console.log(`Converted ${file} successfully.`);
            resolve();
        } catch (error) {
            console.error(`Error converting ${file}: ${error}`);
            reject(error);
        }
    });
}

function moveFilesToTarget() {
    return new Promise((resolve, reject) => {
        try {
            for (const sourcePath of SOURCE_PATHS) {
                const targetPath = path.join(
                    TARGET_FOLDER,
                    path.basename(sourcePath)
                );
                fs.copyFileSync(sourcePath, targetPath);
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

function convertAndSaveFiles() {
    return new Promise((resolve, reject) => {
        const files = fs.readdirSync(SOURCE_PATHS);

        for (const file of files) {
            const filePath = path.join(SOURCE_PATHS, file);

            if (fs.statSync(filePath).isFile()) {
                for (const parser of PARSERS) {
                    fs.mkdirSync(parser.output, { recursive: true });

                    try {
                        const content = fs
                            .readFileSync(filePath, "utf8")
                            .replace(/^\uFEFF/, "");
                        const parsedData = parser.parse(content);

                        const newContent = JSON.stringify(parsedData, null, 4);
                        const outputFilePath = path.join(
                            parser.output,
                            file.replace(path.extname(file), ".json")
                        );

                        fs.writeFileSync(outputFilePath, newContent);
                    } catch (error) {
                        console.error(
                            `\n[parser:${parser.name}] Error parsing file ${filePath}\n`,
                            error
                        );
                    }
                }
            }
        }

        resolve();
    });
}

async function processFiles() {
    // 1. First move files to the target folder
    await generateImagesCdn();

    // 2. Then, get a list of all files in the TARGET_FOLDER
    const files = fs.readdirSync(SOURCE_PATHS);
    console.log(files)
    // 3. Wait for all encoding conversions to finish
    // await Promise.all(files.map((file) => convertEncodingOfFile(file)));

    // 4. Finally, convert and save the files
    await convertAndSaveFiles();
}


async function downloadOriginalFile(){
    const files = fs.readdirSync(SOURCE_PATHS);

    for (const file of files) {
        const filePath = path.join(SOURCE_PATHS, file);
        console.log(file)
        let url
        if(!file.startsWith('items_game')){
             url = `https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/resource/${file}`

        }else{
            url = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/scripts/items/items_game.txt'
        }
        await download(url).then(body=>{
            fs.writeFileSync(filePath, body);
        }).catch(err=>{
            console.log(err.message)
        })
    }

}



function download(url) {
	return new Promise((resolve, reject) => {
		let req = HTTPS.get(url, (res) => {
			if (res.statusCode != 200) {
				return reject(new Error(`HTTP error ${res.statusCode}`));
			}

			let body = '';
			res.on('data', chunk => body += chunk.toString('utf8'));
			res.on('end', () => resolve(body));
		});

		req.on('error', reject);
	});
}

function main(params) {
    // downloadOriginalFile();
    processFiles();
    
}

main()