import utils from "./utils.js";
const doPost = utils.getPostHandlerFor("dsuWizard");

export default class DSU_Builder {
    constructor() {
    }

    getTransactionId(callback) {
        doPost("/begin", callback)
    }

    setDLDomain(transactionId, dlDomain, callback) {
        const url = `/setDLDomain/${transactionId}`;
        doPost(url, dlDomain, callback);
    }

    setKeySSI(transactionId, keyssi, callback) {
        const url = `/setKeySSI/${transactionId}`;
        doPost(url, keyssi, callback);
    }

    setGtinSSI(transactionId, dlDomain, gtin, batch, expiration, callback){
        const body = {dlDomain, gtin, batch, expiration}
        const url = `/gtin/${transactionId}`;
        doPost(url, JSON.stringify(body), callback);
    }

    addFileDataToDossier(transactionId, fileName, fileData, callback) {
        const url = `/addFile/${transactionId}`;

        /*if(fileData instanceof File){*/
            let body = new FormData();
            let inputType = "file";
            body.append(inputType, fileData);
        /*}else{
           body = fileData;
        }*/

        doPost(url, body, {headers: {"x-dossier-path": fileName}}, callback);
    }

    mount(transactionId, path, seed, callback){
        const url = `/mount/${transactionId}`;
        doPost(url, "", {
            headers: {
                'x-mount-path': path,
                'x-mounted-dossier-seed': seed
            }
        }, callback);
    }

    buildDossier(transactionId, callback) {
        const url = `/build/${transactionId}`;
        doPost(url, "", callback);
    }
}