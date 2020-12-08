import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import Batch from "../models/Batch.js";
import StorageService from '../services/StorageService.js';
import DSU_Builder from "../services/DSU_Builder.js";
import utils from "../utils.js";
import LogService from "../services/LogService.js";

const dsuBuilder = new DSU_Builder();

export default class addBatchController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        let batch = new Batch();
        this.setModel({});
        this.storageService = new StorageService(this.DSUStorage);
        this.logService = new LogService(this.DSUStorage);

        dsuBuilder.ensureHolderInfo( (err, holderInfo) => {
            if(!err){
                this.model.username  = holderInfo.userDetails.username;
            } else {
                this.showErrorModalAndRedirect("Invalid configuration detected! Configure your wallet properly in the Holder section!", "batches");
            }
        })

        this.model.batch = batch;
        this.model.products = {
            label: "Product",
            placeholder: "Select a product"
        }
        this.model.versions = {
            label: "Version",
            placeholder: "Select a version"
        }
        this.storageService.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
                if (err || !products) {
                    return this.showErrorModalAndRedirect("Failed to retrieve products list! Create a product first!", "products", 5000);
                }
                const options = [];
                products.forEach(product => {
                    const gtin = Object.keys(product)[0];
                    options.push({label: gtin, value: gtin});
                });
                this.model.products.options = options;
            }
        );

        this.on("add-batch", () => {
            let batch = this.model.batch;
            batch.expiry = utils.convertDateToISO(batch.expiryForDisplay);
            batch.expiry = utils.convertDateFromISOToGS1Format(batch.expiry);
            this.storageService.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) => {

                /*if(err){
                    return this.showErrorModalAndRedirect("Failed to retrieve products list", "batches");
                } */

                this.model.batch.serialNumbers = this.model.batch.serialNumbers.split(/[\r\n ,]+/);
                if (this.model.batch.serialNumbers.length === 0 || this.model.batch.serialNumbers[0] === '') {
                    return this.showErrorModalAndRedirect("Invalid serial numbers", "batches");
                }
                this.model.batch.serialNumber = this.model.batch.serialNumbers[0];

                let error = batch.validate();
                if(err){
                    return this.showErrorModalAndRedirect("Invalid batch info" + err.message, "batches");
                }

                this.showModal("Creating product...");
                this.buildBatchDSU(batch, (err, keySSI) => {
                    if (err){
                        return this.showErrorModalAndRedirect("Batch DSU build failed.", "batches");
                    }
                    batch.keySSI = keySSI;
                    batch.creationTime = utils.convertDateToISO(Date.now());

                    this.buildImmutableDSU(batch, (err, gtinSSI) => {
                        if (err) {
                            return this.showErrorModalAndRedirect("Failed to build immutable DSU", "batches");
                        }
                        this.persistBatchInWallet(batch, (err) => {
                            if (err) {
                                return this.showErrorModalAndRedirect("Batch keySSI failed to be stored.");
                            }
                            this.logService.log({
                                logInfo:batch,
                                username: this.model.username,
                                action: "Created Batch ",
                                logType: 'BATCH_LOG'
                            });
                            this.History.navigateToPageByTag("batches");
                        });
                    });
                });
            });
        });

        this.model.onChange("batch.batchNumber", (event) => {
            this.storageService.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) => {
                if (typeof batches !== "undefined" && batches !== null) {
                    this.batches = batches;
                    this.batchIndex = batches.findIndex(batch => this.model.batch.batchNumber === Object.keys(batch)[0]);
                }
            })
        })

        this.model.onChange("products.value", (event) => {
            this.storageService.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
                this.productIndex = products.findIndex(product => Object.keys(product)[0] === this.model.products.value);
                this.selectedProduct = products[this.productIndex][this.model.products.value];
                this.model.versions.options = this.selectedProduct.map(prod => {
                    return {label: prod.version, value: prod.version};
                });
            });
        })

        this.model.onChange("versions.value", (event) => {
            if (typeof this.productIndex === "undefined") {
                return this.showError("A product should be selected before selecting a version");
            }

            const versionIndex = parseInt(this.model.versions.value) - 1;
            const product = this.selectedProduct[versionIndex];
            this.model.batch.language = product.language;
            this.model.batch.version = product.version;
            this.model.batch.gtin = product.gtin;
            this.model.batch.product = product.keySSI;
        })

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });
    }

    buildBatchDSU(batch, callback) {
        dsuBuilder.getTransactionId((err, transactionId) => {
            if (err) {
                return callback(err);
            }

            let cleanBatch = JSON.parse(JSON.stringify(batch));

            delete cleanBatch.serialNumbers;
            delete cleanBatch.serialNumber;

            dsuBuilder.addFileDataToDossier(transactionId, constants.BATCH_STORAGE_FILE, JSON.stringify(cleanBatch), (err) => {
                if (err) {
                    return callback(err);
                }

                dsuBuilder.mount(transactionId, constants.PRODUCT_DSU_MOUNT_POINT, cleanBatch.product, (err) => {
                    if (err) {
                        return callback(err);
                    }
                    dsuBuilder.buildDossier(transactionId, callback);
                });
            });
        });
    }

    buildImmutableDSU(batch, callback) {
        dsuBuilder.getTransactionId((err, transactionId) => {
            if (err) {
                return callback(err);
            }

            if(!batch.gtin || !batch.batchNumber || !batch.expiry){
                alert("A mandatory field is missing");
                return;
            }
            dsuBuilder.setGtinSSI(transactionId, dsuBuilder.holderInfo.domain, batch.gtin, batch.batchNumber, batch.expiry, (err) => {
                if (err) {
                    return callback(err);
                }
                //TODO: derive a sReadSSI here...
                dsuBuilder.mount(transactionId, "/batch", batch.keySSI, (err) => {
                    if (err) {
                        return callback(err);
                    }
                    dsuBuilder.buildDossier(transactionId, callback);
                });
            });
        });
    }

    persistBatchInWallet(batch, callback) {
        this.storageService.getItem(constants.BATCHES_STORAGE_PATH, 'json', (err, batches) => {
            if (err) {
                // if no products file found an error will be captured here
                //todo: improve error handling here
                this.showError(err);
            }

            if (typeof batches === "undefined" || batches === null) {
                batches = [];
            }

            batches.push(batch);
            this.storageService.setItem(constants.BATCHES_STORAGE_PATH, JSON.stringify(batches), callback);
        });
    }

};