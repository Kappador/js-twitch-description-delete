const needle = require('needle');
const { parentPort, workerData } = require('node:worker_threads');
const proxyAgent = require('https-proxy-agent');
const ra = require('random-useragent');

function getTwitchHeader(token = "") {
    const header = {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US",
        "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        Connection: "keep-alive",
        "Content-Type": "text/plain; charset=UTF-8",
        "Device-ID": "".concat(Math.random().toString(36).substring(2, 15), Math.random().toString(36).substring(2, 15)),
        Origin: "https://www.twitch.tv",
        Referer: "https://www.twitch.tv/",
        Authorization: "OAuth " + token,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-GPC": "1",
        "User-Agent": ra.getRandom(),
    };
    return header;
}

async function getTokenInfo(token, agent = false) {
    return new Promise((resolve, reject) => {
        const baseUrl = "https://gql.twitch.tv/gql";
        const json = [
            {
                operationName: "Settings_ProfilePage_AccountInfoSettings",
                variables: {},
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash:
                            "60a54ebcbd29e095db489ed6268f33d5fe5ed1d4fa3176668d8091587ae81779",
                    },
                },
            },
        ];

        needle("post", baseUrl, JSON.stringify(json), { headers: getTwitchHeader(token), json: true, agent: agent }).then((res) => {
            if (res.statusCode != 200) {
                return resolve({ error: true, message: "Failed to get token info", token: token });
            }

            if (res.body.error) {
                return resolve({ error: true, message: "Failed to get token info", token: token });
            }

            let data = res.body[0].data;
            return resolve({
                error: false, data: {
                    displayName: data.currentUser.displayName,
                    id: data.currentUser.id,
                },
                token: token
            });
        }).catch((err) => {
            return resolve({ error: true, message: err, token: token });
        });

    });
}

async function deleteDescription(token, agent = false) {
    return new Promise(async resolve => {
        let info = await getTokenInfo(token, agent);
        if (info.error) {
            return resolve(info);
        }

        if (!info.data) {
            return resolve({ error: true, message: "No data found", token: token });
        }

        needle("post", "https://gql.twitch.tv/gql", {
            "operationName": "UpdateUserProfile",
            "variables": {
                "input": {
                    "description": "",
                    "displayName": info.data.displayName,
                    "userID": info.data.id,
                }
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "991718a69ef28e681c33f7e1b26cf4a33a2a100d0c7cf26fbff4e2c0a26d15f2"
                }
            }
        }, {
            headers: {
                "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                "Authorization": `OAuth ${token}`,
                "Content-Type": "application/json",
                "User-Agent": ra.getRandom(),
            },
            json: true
        }).then((res) => {
            if (res.statusCode != 200 || res.body.errors || res.body.error) {
                return resolve({ error: true, message: "Failed to delete description", token: token });
            }

            let responseData = res.body.data[0];

            if (!responseData.updateUser.user || responseData.updateUser.user.description != "") {
                return resolve({ error: true, message: "Failed to delete description", token: token });
            }

            return resolve({ error: false, message: "Description deleted", token: token });
        }).catch((err) => {
            return resolve({ error: true, message: err, token: token });
        });
    })
}

async function startWorker(proxies, tokens, delay) {
    let agent = false;

    while (tokens.length > 0) {
        let token = tokens.pop();
        let proxy = false;
        if (proxies) {
            proxy = proxies[Math.floor(Math.random() * proxies.length)]
        }
        if (proxy) {
            agent = proxyAgent("http://"+proxy);
        }

        let info = await getTokenInfo(token, agent);
        if (info.error) {
            parentPort.postMessage(info);
            continue;
        }
        parentPort.postMessage(tokens.length );
        if (!info.data) {
            parentPort.postMessage(info);
            continue;
        }
        let response = await deleteDescription(token, agent);
        if (response.error) {
            parentPort.postMessage(info);
            continue;
        }
        parentPort.postMessage(response);
    }

    parentPort.postMessage({ done: true });
}

startWorker(workerData.proxies, workerData.token, workerData.delay);