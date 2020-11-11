import ContainerController from '../../cardinal/controllers/base-controllers/ContainerController.js';
import Product from '../models/Product.js';
import Languages from "../models/Languages.js";
import constants from '../constants.js';
import storage from '../services/Storage.js';
import DSU_Builder from '../services/DSU_Builder.js';

const dsuBuilder = new DSU_Builder();
const PRODUCT_STORAGE_FILE = constants.PRODUCT_STORAGE_FILE;
const PRODUCT_IMAGE_FILE = constants.PRODUCT_IMAGE_FILE;
const LEAFLET_ATTACHMENT_FILE = constants.LEAFLET_ATTACHMENT_FILE;
const DOMAIN_NAME = constants.DOMAIN_NAME;

export default class ManageProductController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        this.setModel({});
        this.productIndex = this.History.getState();
        this.model.languages = {
            label: "Language",
            placeholder: "Select a language",
            options: Languages.getListAsVM()
        };

        storage.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
            if (err) {
                throw err;
            }
            this.products = products;
            if (typeof this.productIndex !== "undefined") {
                const productVersions = Object.values(this.products[this.productIndex])[0];
                this.model.product = new Product(productVersions[productVersions.length - 1]);
                this.model.product.version++;
            } else {
                this.model.product = new Product();
            }
        });

        this.on("product-photo-selected", (event) => {
            this.productPhoto = event.data;
        });

        this.on("leaflet-selected", (event) => {
            this.leafletFiles = event.data;
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });

        this.model.onChange("product.gtin", (event) => {

        })

        this.on("add-product", (event) => {
            if (typeof this.leafletFiles === "undefined" || this.leafletFiles.length === 0) {
                return this.showError("Cannot save the product because a leaflet was not provided.");
            }
            this.incrementVersionForExistingProduct();
            let product = this.model.product;
            let validationResult = product.validate();
            if (Array.isArray(validationResult)) {
                for (let i = 0; i < validationResult.length; i++) {
                    let err = validationResult[i];
                    this.showError(err);
                }
                return;
            }
            this.buildProductDSU(product, (err, keySSI) => {
                if (err) {
                    return this.showError(err, "Product DSU build failed.");
                }
                product.keySSI = keySSI;
                console.log("Product DSU KeySSI:", keySSI);
                this.persistProduct(product, (err) => {
                    if (err) {
                        this.showError(err, "Product keySSI failed to be stored.");
                        return;
                    }

                    history.push("?products");
                });
            });
        });
    }

    incrementVersionForExistingProduct() {
        if (typeof this.productIndex === "undefined" && typeof this.products !== "undefined" && this.products !== null) {
            const products = this.products.map(product => {
                return Object.keys(product)[0];
            });
            this.productIndex = products.findIndex(gtin => gtin === this.model.product.gtin);
            if (this.productIndex >= 0) {
                const prodVersionsArr = this.products[this.productIndex][this.model.product.gtin];
                this.model.product = new Product(prodVersionsArr[prodVersionsArr.length - 1]);
                this.model.product.version++;
            }
        }
    }

    buildProductDSU(product, callback) {
        dsuBuilder.getTransactionId((err, transactionId) => {
            if (err) {
                return callback(err);
            }

            const basePath = '/' + product.version + '/' + product.language;
            product.photo = basePath + PRODUCT_IMAGE_FILE;
            product.leaflet = basePath + LEAFLET_ATTACHMENT_FILE;
            const productStorageFile = basePath + PRODUCT_STORAGE_FILE;
            const addFilesToDSU = (callback) => {
                dsuBuilder.addFileDataToDossier(transactionId, productStorageFile, JSON.stringify(product), (err) => {
                    if (err) {
                        return callback(err);
                    }
                    dsuBuilder.addFileDataToDossier(transactionId, product.photo, this.productPhoto, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        this.uploadLeafletFiles(transactionId, basePath, this.leafletFiles, (err, data) => {
                            if (err) {
                                return callback(err);
                            }
                            dsuBuilder.buildDossier(transactionId, callback);
                        });
                    });
                });

            };

            if (product.version > 1) {
                storage.getItem(constants.PRODUCT_KEYSSI_STORAGE_PATH, "json", (err, keySSIs) => {
                    if (err) {
                        return callback(err);
                    }

                    dsuBuilder.setKeySSI(transactionId, keySSIs[product.gtin], (err) => {
                        if (err) {
                            return callback(err);
                        }

                        addFilesToDSU(callback);
                    });
                });
            } else {
                dsuBuilder.setDLDomain(transactionId, DOMAIN_NAME, (err) => {
                    if (err) {
                        return callback(err);
                    }

                    addFilesToDSU((err, keySSI) => {
                        if (err) {
                            return callback(err);
                        }

                        this.persistKeySSI(keySSI, product.gtin, err => callback(err, keySSI));
                    });
                });
            }
        });
    }

    uploadFile(transactionId, filename, file, callback) {
        dsuBuilder.addFileDataToDossier(transactionId, filename, file, (err, data) => {
            if (err) {
                return callback(err);
            }
            callback(undefined, data);
        });
    }

    uploadLeafletFiles(transactionId, basePath, files, callback) {
        if (files === undefined || files === null) {
            return callback(undefined, []);
        }
        let xmlFiles = files.filter((file) => file.name.endsWith('.xml'))
        if (xmlFiles.length === 0) {
            return callback(new Error("No xml files found."))
        }
        let anyOtherFiles = files.filter((file) => !file.name.endsWith('.xml'))
        let responses = [];
        this.uploadFile(transactionId, basePath + LEAFLET_ATTACHMENT_FILE, xmlFiles[0], (err, data) => {
            if (err) {
                return callback(err);
            }
            responses.push(data);

            let uploadFilesRecursive = (file) => {
                this.uploadFile(transactionId, basePath + "/" + file.name, file, (err, data) => {
                    if (err) {
                        return callback(err);
                    }
                    responses.push(data);
                    if (anyOtherFiles.length > 0) {
                        uploadFilesRecursive(anyOtherFiles.shift())
                    } else {
                        return callback(undefined, responses);
                    }
                });
            }

            if (anyOtherFiles.length > 0) {
                return uploadFilesRecursive(anyOtherFiles.shift());
            }
            return callback(undefined, responses);
        });
    }

    persistProduct(product, callback) {
        if (typeof this.products === "undefined" || this.products === null) {
            this.products = [];
        }

        if (typeof this.productIndex !== "undefined" && this.productIndex >= 0) {
            this.products[this.productIndex][product.gtin].push(product);
        } else {
            const prodElement = {};
            prodElement[product.gtin] = [product];
            this.products.push(prodElement);
        }
        storage.setItem(constants.PRODUCTS_STORAGE_PATH, JSON.stringify(this.products), callback);
    }

    persistKeySSI(keySSI, gtin, callback) {
        storage.getItem(constants.PRODUCT_KEYSSI_STORAGE_PATH, "json", (err, keySSIs) => {
            if (typeof keySSIs === "undefined" || keySSIs === null) {
                keySSIs = {};
            }

            keySSIs[gtin] = keySSI;
            storage.setItem(constants.PRODUCT_KEYSSI_STORAGE_PATH, JSON.stringify(keySSIs), callback);
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
}