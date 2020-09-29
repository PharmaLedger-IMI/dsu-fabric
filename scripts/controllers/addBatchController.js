import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import Batch from "../models/Batch.js";
import Countries from "../models/Countries.js";
import storage from "../services/Storage.js";
import DSU_Builder from "../services/DSU_Builder.js";

const dsuBuilder = new DSU_Builder();

export default class addBatchController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        let batch = new Batch();
        this.setModel({});
        this.model.batch = batch;
        this.model.countries = {
            label: "Country",
            placeholder: "Select a country",
            options: Countries.getListAsVM()
        };
        this.model.products = {
            label: "Product",
            placeholder: "Select a product"
        }
        storage.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products)=>{
                if(err){
                    return console.log(err);
                }
                const options = [];
                products.forEach( (product) => {
                    options.push({label: product.name, value: product.keySSI});
                });
                this.model.products.options = options;
            }
        )

        this.on("add-batch", () => {
            let batch = this.model.batch;
            let validationResult = batch.validate();
            if (Array.isArray(validationResult)) {
                for (let i = 0; i < validationResult.length; i++) {
                    let err = validationResult[i];
                    this.showError(err);
                }
                return;
            }

            this.buildBatchDSU(batch, (err, keySSI) => {
                if (err) {
                    return this.showError(err, "Batch DSU build failed.");
                }
                batch.keySSI = keySSI;
                this.persistBatch(batch, (err) => {
                    if (err) {
                        this.showError(err, "Batch keySSI failed to be stored.");
                        return;
                    }

                    history.push("?batches");
                });
            });
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });
    }

    buildBatchDSU(batch, callback){
        dsuBuilder.getTransactionId((err, transactionId) => {
            if(err){
                return callback(err);
            }

            dsuBuilder.setDLDomain(transactionId, constants.DOMAIN_NAME, (err) => {
                if(err){
                    return callback(err);
                }

                dsuBuilder.addFileDataToDossier(transactionId, constants.BATCH_STORAGE_FILE, JSON.stringify(batch), (err) => {
                    if(err){
                        return callback(err);
                    }

                    dsuBuilder.mount(transactionId, constants.PRODUCT_DSU_MOUNT_POINT, batch.product, (err) => {
                        if(err){
                            return callback(err);
                        }

                        dsuBuilder.buildDossier(transactionId, callback);
                    });
                });
            });

        });
    }

    persistBatch(batch, callback){
        storage.getItem(constants.BATCHES_STORAGE_PATH, 'json', (err, batches) => {
            if (err) {
                // if no products file found an error will be captured here
                //todo: improve error handling here
            }

            if (typeof batches === "undefined" || batches === null) {
                batches = [];
            }

            batches.push(batch);
            storage.setItem(constants.BATCHES_STORAGE_PATH, JSON.stringify(batches), callback);
        });
    }

    showError(err, title, type) {
        let errMessage;
        title = title ? title : 'Validation Error';
        type = type ? type : 'alert-danger';

        if (err instanceof Error) {
            errMessage = err.message;
        } else if (typeof err === 'object') {
            errMessage = err.toString();
        } else {
            errMessage = err;
        }
        this.feedbackEmitter(errMessage, title, type);
    }
};