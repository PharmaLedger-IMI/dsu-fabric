import ContainerController from '../../cardinal/controllers/base-controllers/ContainerController.js';
import Product from '../models/Product.js';
import constants from '../constants.js';
import storage from '../services/Storage.js';
import DSU_Builder from '../services/DSU_Builder.js';

const dsuBuilder = new DSU_Builder();
const PRODUCT_STORAGE_FILE = constants.PRODUCT_STORAGE_FILE;
const PRODUCT_IMAGE_FILE = constants.PRODUCT_IMAGE_FILE;
const LEAFLET_ATTACHMENT_FILE = constants.LEAFLET_ATTACHMENT_FILE;
const DOMAIN_NAME = constants.DOMAIN_NAME;

export default class newProductController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        this.setModel({});
        if (typeof history.location.state !== "undefined") {
            this.productIndex = history.location.state.productIndex;
        }
        if (typeof this.productIndex !== "undefined") {
            this.DSUStorage.getObject(constants.PRODUCTS_STORAGE_PATH, (err, products) => {
                if (err) {
                    throw err;
                }

                this.model.product = new Product(products[this.productIndex]);
            });
        } else {
            this.model.product = new Product();
        }

        this.on("product-photo-selected", (event) => {
            this.productPhoto = event.data;
        });

        this.on("leaflet-selected", (event) => {
            this.leafletFile = event.data[0];
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });

        this.on("add-product", (event) => {
            let product = this.model.product;
            let validationResult = product.validate();
            if (Array.isArray(validationResult)) {
                for (let i = 0; i < validationResult.length; i++) {
                    let err = validationResult[i];
                    this.showError(err);
                }
                return;
            }
            this.buildProductDSU (product, (err, keySSI) =>{
                if (err) {
                    return this.showError(err, "Product DSU build failed.");
                }
                product.keySSI = keySSI;
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

    buildProductDSU (product, callback) {
        dsuBuilder.getTransactionId((err, transactionId) => {
            if (err) {
                return callback(err);
            }
            dsuBuilder.setDLDomain(transactionId, DOMAIN_NAME, (err) => {
                if (err) {
                    return callback(err);
                }
                product.photo = PRODUCT_IMAGE_FILE;
                product.leaflet = LEAFLET_ATTACHMENT_FILE;
                dsuBuilder.addFileDataToDossier(transactionId, PRODUCT_STORAGE_FILE, JSON.stringify(product), (err) => {
                    if (err) {
                        return callback(err);
                    }
                    dsuBuilder.addFileDataToDossier(transactionId, PRODUCT_IMAGE_FILE, this.productPhoto, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        dsuBuilder.addFileDataToDossier(transactionId, LEAFLET_ATTACHMENT_FILE, this.leafletFile, (err) => {
                            if (err) {
                                return callback(err);
                            }
                            dsuBuilder.buildDossier(transactionId, callback);
                        });
                    });
                });
            });

        });
    }

    persistProduct(product, callback) {
        storage.getItem(constants.PRODUCTS_STORAGE_PATH, 'json', (err, products) => {
            if (err) {
                // if no products file found an error will be captured here
                //todo: improve error handling here
            }

            if (typeof products === "undefined" || products === null) {
                products = [];
            }

            if (typeof this.productIndex !== "undefined") {
                products.splice(this.productIndex, 1);
            } else {
                const prod = products.find(prod => prod.name === product.name);
                if (typeof prod !== "undefined") {
                    return callback(new Error("Product already exists into the list!"));
                }
            }

            products.push(product);
            storage.setItem(constants.PRODUCTS_STORAGE_PATH, JSON.stringify(products), callback);
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