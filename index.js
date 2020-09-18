require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const clipboardy = require("clipboardy");
const moment = require("moment");
const FormData = require("form-data");

const logDir = process.env.LOG_DIR;

const getDate = () => {
  try {
    const argDate = process.argv[2];
    return new Date(argDate).toDateString();
  } catch (err) {
    console.log(`Error: ${err}`);
  }
};

const isNotARaid = (name) => {
  return (
    [
      "Arkk",
      "Artsariiv",
      "MAMA",
      "Nightmare Oratuss",
      "Skorvald the Shattered",
      "Ensolyss of the Endless Torment",
    ].includes(name) || name.includes("Kitty Golem")
  );
};

const logPost = (fullPath) => {
  const name = path.basename(fullPath);
  const dir = path.basename(path.dirname(fullPath));

  console.log(`Posting ${dir}/${name}`);
};

const sendToDPSReport = (fullPath) => {
  const formData = new FormData();
  formData.append("json", 1);
  formData.append("file", fs.createReadStream(fullPath));
  return axios({
    method: "post",
    url: "https://dps.report/uploadContent",
    data: formData,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
    },
  }).then((res) => {
    urls.push(res.data.permalink);
  });
};

/* 
  using a global array probably isn't the way to go
  but it's simple and this script has a limited scope
  so it will be fine for this scenario 
*/
let urls = [];

const processFiles = async (rootDir, date) => {
  let promises = [];
  const children = await fs.promises.readdir(rootDir, { withFileTypes: true });
  for (const child of children) {
    if (isNotARaid(child.name)) continue;

    const fullPath = path.join(rootDir, child.name);

    if (child.isDirectory()) {
      promises.push(processFiles(fullPath, date));
    } else {
      const stat = await fs.promises.stat(fullPath);
      const lastModified = stat.mtime.toDateString();
      if (lastModified === date) {
        try {
          logPost(fullPath);
          promises.push(sendToDPSReport(fullPath));
        } catch (err) {
          console.log(`${err}`);
        }
      }
    }
  }
  // this means we don't need to wait to receive a response
  // for each request before moving on.
  await Promise.all(promises);
};

const sortArrayByTime = () => {
  const getTimeHelper = (str) => {
    const test = /\d{8}-\d{6}/
    const timeStr = str.match(test)[0]; 
    const date = moment(timeStr, 'YYYYMMDD-HHmmss').toDate().getTime();
    return date;
  }

  urls.sort((a, b) => {
    return getTimeHelper(a) - getTimeHelper(b);
  });
}

const main = async () => {
  const dateToCheck = getDate();
  await processFiles(logDir, dateToCheck);
  sortArrayByTime();

  const str = urls.reduce((result, s) => result += `\n${s}`);
  console.log(str);
  clipboardy.writeSync(str);
  console.log("Copied to clipboard");
};

main();
