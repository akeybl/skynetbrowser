const os = require('os');

const isMac = os.platform() === "darwin";
const isWindows = os.platform() === "win32";
const isLinux = os.platform() === "linux";

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}

async function randomDelay(min, max) {
    await delay(Math.floor(Math.random() * (max - min + 1) + min));
}

function formatDate(date) {
    // Extracting components from the date
    let day = date.getDate();
    let month = date.getMonth() + 1; // Months are 0-indexed
    let year = date.getFullYear().toString().substr(-2); // Get last 2 digits of year
    let hour = date.getHours();
    let minute = date.getMinutes();
    let ampm = hour >= 12 ? 'pm' : 'am';

    // Converting 24h time to 12h time format
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'

    // Ensuring two-digit minute format
    minute = minute < 10 ? '0' + minute : minute;

    // Formatting the string
    return `${month}/${day}/${year} ${hour}:${minute}${ampm}`;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { isMac, isWindows, isLinux, delay, randomDelay, formatDate, getRandomInt };
