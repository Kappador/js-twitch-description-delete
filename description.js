const vorpal = require('vorpal')();
const chalk = require('chalk');
const { Worker } = require('node:worker_threads');
const fs = require('fs');
console.log(chalk.green(`https://discord.gg/`) + chalk.red(`kappa`) + chalk.yellow(" | ") + chalk.green(`https://discord.gg/`) + chalk.red(`kappahost`))

let runningWorkers = 0;
let success = 0;
let startTime = new Date().getTime();

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createWorkers(proxies, tokens, delay, threads, time) {

    vorpal.hide();
    console.log(chalk.green(`Starting bot with ${chalk.magenta(tokens.length)} tokens and with ${chalk.magenta(threads)} threads`));
    if (tokens < threads) {
        console.log(chalk.red(`Not enough tokens to start ${threads} threads`));
        return;
    }

    let chunks = [];

    if (threads > 1) {
        let temp_thread_amount = threads == 2 ? 2 : threads - 1;
        let per_thread = tokens.length / temp_thread_amount;
        per_thread = Math.floor(per_thread);
        for (let i = 0; i < temp_thread_amount; i++) {
            chunks.push(tokens.splice(0, per_thread));
        }
        chunks.push(tokens);

        chunks = chunks.filter(chunk => chunk.length > 0);
    } else {
        chunks.push(tokens);
    }

    let promises = [];

    for (let i = 0; i < chunks.length; i++) {
        let start = new Date().getTime();

        let promise = new Promise(resolve => {
            let token = chunks[i];
            let worker = new Worker("./worker_desc.js", {
                workerData: {
                    proxies: proxies,
                    token: token,
                    delay: delay,
                }
            });
            worker.on("message", (message) => {

                if (message.done) {
                    resolve();
                }

                if (!fs.existsSync('./output/')) {
                    fs.mkdirSync('./output/');
                }

                if (!fs.existsSync(`./output/${time}/`)) {
                    fs.mkdirSync(`./output/${time}/`);
                }

                let elapse = (new Date().getTime() - start) / 1000;
                data.time.times.push(time);

                if (message.error) {
                    fs.writeFileSync(`./output/${time}/fails.txt`, message.token + "\n", { flag: 'a' });
                    console.log(chalk.red(`failed to delete description | ${chalk.magenta(elapse + "s")}`));
                    data.descs.fails++;
                } else if (message.error == false) {
                    fs.writeFileSync(`./output/${time}/successes.txt`, message.token + "\n", { flag: 'a' });
                    success++;
                    console.log(chalk.green(`description deleted | ${chalk.magenta(elapse + "s")}`));
                }
            });
        });

        promise.catch((err) => {
            let time = (new Date().getTime() - start) / 1000;
            data.time.times.push(time);
            console.log(chalk.red(`failed to delete description | ${err} ${chalk.magenta(time + "s")}`));
            data.descs.fails++;
        })

        promises.push(promise);
    }
    Promise.all(promises).then(() => {
        console.log(chalk.green(`deleted ${success} descriptions`));
        vorpal.delimiter("descdeleter !°!").show();
    });


}

let data = {
    tokens: 0,
    descs: {
        success: success,
        fails: 0,
    },
    threads: {
        running: runningWorkers,
        maximum: 0
    },
    time: {
        times: [],
        avg: 0,
        since: new Date().getTime()
    }
}

setInterval(() => {
    data.success = success;
    data.threads.running = runningWorkers;
    let sum = 0;
    for (let i = 0; i < data.time.times.length; i++) {
        sum += data.time.times[i];
    }

    if (isNaN(sum)) {
        data.time.avg = 0;
    } else {
        data.time.avg = sum / data.time.times.length;
        data.time.avg = data.time.avg.toFixed(2);
    }

    data.time.since = ((new Date().getTime() - startTime) / 1000).toFixed(0);

    setWindowTitle(data);

}, 10000);

function setWindowTitle(data) {
    process.title = `twitch.kappa.host | ${data.descs.success}/${data.tokens} descs | ${data.descs.fails} fails | ${data.threads.running}/${data.threads.maximum} threads | ${data.time.avg}s avg delete time | ${data.time.since}s since start`;
}

vorpal.command('start', 'Starts the description deleter').action(async function (args, callback) {
    let prompt = await this.prompt([
        {
            type: 'input',
            name: 'proxy',
            message: 'Enter the proxy file: ',
            default: 'none'
        },
        {
            type: 'input',
            name: 'token',
            message: 'Enter the token file: ',
            default: './tokens.txt'
        },
        {
            type: 'input',
            name: 'delay',
            message: 'Enter the delay (ms): ',
            default: '1000'
        },
        {
            type: 'input',
            name: 'threads',
            message: 'Enter the amount of threads: ',
            default: '1'
        },
    ]);

    let tokens = fs.readFileSync(prompt.token).toString().split("\r\n");

    let proxies = false;
    if (prompt.proxy != "none") {
        proxies = fs.readFileSync(prompt.proxy).toString().split("\r\n");
    }

    if (tokens.length < prompt.threads) {
        console.log(chalk.red(`Not enough tokens to start ${prompt.threads} threads`));
        return;
    }

    if (!tokens.length) {
        console.log(chalk.red(`No tokens found`));
        return;
    }
    createWorkers(proxies, tokens, parseInt(prompt.delay), parseInt(prompt.threads), new Date().getTime());

})

vorpal.delimiter("descdeleter !°!").show();