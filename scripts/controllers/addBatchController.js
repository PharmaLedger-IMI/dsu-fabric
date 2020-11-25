import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import Batch from "../models/Batch.js";
import storage from "../services/Storage.js";
import DSU_Builder from "../services/DSU_Builder.js";
import utils from "../utils.js";
import LogService from "../services/LogService.js";

const dsuBuilder = new DSU_Builder();

export default class addBatchController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        let batch = new Batch();
        this.setModel({});
        this.model.batch = batch;

        this.model.products = {
            label: "Product",
            placeholder: "Select a product"
        }
        this.model.versions = {
            label: "Version",
            placeholder: "Select a version"
        }
        storage.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
                if (err) {
                    return console.log(err);
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
            batch.expiry = utils.convertDateToISO(batch.expiry);
            storage.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) => {
                if (typeof batches !== "undefined" && batches !== null) {
                    this.batches = batches;
                    this.batchIndex = batches.findIndex(batch => this.model.batch.batchNumber === batch.batchNumber);
                }

                if (this.batchIndex >= 0) {
                    return this.showError("The provided batch number is already associated with a product. Please insert another one");
                }

                this.model.batch.serialNumbers = this.model.batch.serialNumbers.split(/[\r\n ,]+/);
                if (this.model.batch.serialNumbers.length === 0 || this.model.batch.serialNumbers[0] === '') {
                    return this.showError("Invalid serial numbers");
                }
                this.model.batch.serialNumber = this.model.batch.serialNumbers[0];
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

                    LogService.log({
                        ...batch,
                        action: "created batch",
                        logType: 'BATCH_LOG'
                    });

                    this.persistBatch(batch, (err) => {
                        if (err) {
                            this.showError(err, "Batch keySSI failed to be stored.");
                            return;
                        }

                        this.buildImmutableDSU(batch, (err, gtinSSI) => {
                            if (err) {
                                return this.showError(err, "Failed to build immutable DSU")
                            }

                            console.log("Immutable DSU GtinSSI:", gtinSSI);
                            this.History.navigateToPageByTag("batches");
                        });
                    });
                });
            });
        });

        this.model.onChange("batch.batchNumber", (event) => {
            storage.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) => {
                if (typeof batches !== "undefined" && batches !== null) {
                    this.batches = batches;
                    this.batchIndex = batches.findIndex(batch => this.model.batch.batchNumber === Object.keys(batch)[0]);
                }
            })
        })

        this.model.onChange("products.value", (event) => {
            storage.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
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

            dsuBuilder.setDLDomain(transactionId, constants.DOMAIN_NAME, (err) => {
                if (err) {
                    return callback(err);
                }

                dsuBuilder.addFileDataToDossier(transactionId, constants.BATCH_STORAGE_FILE, JSON.stringify(batch), (err) => {
                    if (err) {
                        return callback(err);
                    }

                    dsuBuilder.mount(transactionId, constants.PRODUCT_DSU_MOUNT_POINT, batch.product, (err) => {
                        if (err) {
                            return callback(err);
                        }

                        dsuBuilder.buildDossier(transactionId, callback);
                    });
                });
            });
        });
    }

    buildImmutableDSU(batch, callback) {
        dsuBuilder.getTransactionId((err, transactionId) => {
            if (err) {
                return callback(err);
            }
            const gs1Date = utils.convertDateFromISOToGS1Format(batch.expiry);
            dsuBuilder.setGtinSSI(transactionId, constants.DOMAIN_NAME, batch.gtin, batch.batchNumber, gs1Date, (err) => {
                if (err) {
                    return callback(err);
                }
                dsuBuilder.mount(transactionId, "/batch", batch.keySSI, (err) => {
                    if (err) {
                        return callback(err);
                    }

                    dsuBuilder.buildDossier(transactionId, callback);
                });
            });
        });
    }

    persistBatch(batch, callback) {
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