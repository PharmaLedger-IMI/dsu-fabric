import ContainerController from '../../cardinal/controllers/base-controllers/ContainerController.js';
import Product from '../models/Product.js';
import Languages from "../models/Languages.js";
import constants from '../constants.js';
import StorageService from '../services/StorageService.js';
import DSU_Builder from '../services/DSU_Builder.js';
import UploadTypes from "../models/UploadTypes.js";
import utils from "../utils.js";
import LogService from '../services/LogService.js';


const dsuBuilder = new DSU_Builder();
const PRODUCT_STORAGE_FILE = constants.PRODUCT_STORAGE_FILE;
const PRODUCT_IMAGE_FILE = constants.PRODUCT_IMAGE_FILE;
const LEAFLET_ATTACHMENT_FILE = constants.LEAFLET_ATTACHMENT_FILE;
const SMPC_ATACHMENT_FILE = constants.SMPC_ATACHMENT_FILE;

export default class ManageProductController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        this.setModel({});
        this.storageService = new StorageService(this.DSUStorage);
        this.logService = new LogService(this.DSUStorage);

        let state = this.History.getState();
        this.productIndex = state !== undefined ? state.index : undefined;
        this.model.languages = {
            label: "Language",
            placeholder: "Select a language",
            options: Languages.getListAsVM()
        };

        this.model.languageTypeCards = []

        this.on("delete-language-leaflet", (event) => {
            this.model.languageTypeCards = this.model.languageTypeCards.filter(lf => !(lf.type.value === event.data.type.value && lf.language.value === event.data.language.value));
        });

        this.on("add-language-leaflet", (event) => {
            this.addLanguageTypeFilesListener(event)
        });

        this.storageService.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
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

            dsuBuilder.ensureHolderInfo( (err, holderInfo) => {
                if(!err && holderInfo){
                    console.log(holderInfo)
                    this.model.product.manufName = holderInfo.userDetails.company;
                    this.model.username  = holderInfo.userDetails.username;
                } else {
                    this.showError("Invalid configuration detected! Configure your wallet properly in the Holder section!")
                   // this.History.navigateToPageByTag("error");
                }
            })
        });

        this.on("product-photo-selected", (event) => {
            this.productPhoto = event.data;
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });

        this.model.onChange("product.gtin", (event) => {

        })

        this.on("add-product", (event) => {
            let product = this.model.product;

            if (!this.isValid(product)) {
                return;
            }

            this.incrementVersionForExistingProduct();

            this.showLoadingModal();
            this.buildProductDSU(product, (err, keySSI) => {
                if (err) {
                    this.hideLoadingModal();
                    return this.showError(err, "Product DSU build failed.");
                }
                product.keySSI = keySSI;

                console.log("Product DSU KeySSI:", keySSI);
                this.persistProduct(product, (err) => {
                    if (err) {
                        this.hideLoadingModal();
                        this.showError(err, "Product keySSI failed to be stored.");
                        return;
                    }
                    this.hideLoadingModal();
                    this.History.navigateToPageByTag("products");
                });
            });
        });
    }

    addLanguageTypeFilesListener(event) {
        let actionModalModel = {
            title: "Choose language and type of upload",
            acceptButtonText: 'Accept',
            denyButtonText: 'Cancel',
            languages: {
                label: "Language",
                placeholder: "Select a language",
                options: Languages.getListAsVM()
            },
            types: {
                label: "Type",
                placeholder: "Select a type",
                options: UploadTypes.getListAsVM()
            },
            product: {
                language: "en",
                type: "leaflet"
            }
        }
        this.showModal('selectLanguageAndType', actionModalModel, (err, response) => {
            if (err || response === undefined) {
                return;
            }
            if (this.typeAndLanguageExist(response.language, response.type)) {
                return alert('This language and type combo already exist.');
            }
            let selectedLanguage = Languages.getListAsVM().find(lang => lang.value === response.language);
            let selectedType = UploadTypes.getListAsVM().find(type => type.value === response.type);
            let eventName = `select-files-${response.language}-${response.type}`;
            this.model.languageTypeCards.push({
                type: selectedType,
                language: selectedLanguage,
                attachLabel: `Upload ${selectedType.label}`,
                fileSelectEvent: eventName,
                files: []
            });

            this.on(eventName, (event) => {
                const eventNameParts = event.type.split('-');
                const language = eventNameParts[2];
                const type = eventNameParts[3];
                this.model.languageTypeCards.find(lf => lf.type.value === type && lf.language.value === language).files = event.data;
            });
        });
    }

    typeAndLanguageExist(language, type) {
        return this.model.languageTypeCards.findIndex(lf => lf.type.value === type && lf.language.value === language) !== -1;
    }

    filesWereProvided() {
        return this.model.languageTypeCards.filter(lf => lf.files.length > 0).length > 0;
    }

    isValid(product) {
        if (!this.filesWereProvided()) {
            this.showError("Cannot save the product because a leaflet was not provided.");
            return false;
        }
        let validationResult = product.validate();
        if (Array.isArray(validationResult)) {
            for (let i = 0; i < validationResult.length; i++) {
                let err = validationResult[i];
                this.showError(err);
            }
            return false;
        }
        return true;
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

            if (product.version > 1) {
                this.updateProductDSU(transactionId, product, callback);
            } else {
                this.createProductDSU(transactionId, product, callback);
            }
        });
    }

    createProductDSU(transactionId, product, callback) {
        this.addProductFilesToDSU(transactionId, product, (err, keySSI) => {
            if (err) {
                return callback(err);
            }

            this.persistKeySSI(keySSI, product.gtin, err => callback(err, keySSI));
        });
    }

    updateProductDSU(transactionId, product, callback) {
        this.storageService.getItem(constants.PRODUCT_KEYSSI_STORAGE_PATH, "json", (err, keySSIs) => {
            if (err) {
                return callback(err);
            }

            dsuBuilder.setKeySSI(transactionId, keySSIs[product.gtin], (err) => {
                if (err) {
                    return callback(err);
                }

                this.addProductFilesToDSU(transactionId, product, callback);
            });
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

    addProductFilesToDSU(transactionId, product, callback) {
        const basePath = '/' + product.version;
        product.photo = basePath + PRODUCT_IMAGE_FILE;
        product.leaflet = basePath + LEAFLET_ATTACHMENT_FILE;
        const productStorageFile = basePath + PRODUCT_STORAGE_FILE;
        dsuBuilder.addFileDataToDossier(transactionId, productStorageFile, JSON.stringify(product), (err) => {
            if (err) {
                return callback(err);
            }
            dsuBuilder.addFileDataToDossier(transactionId, product.photo, this.productPhoto, (err) => {
                if (err) {
                    return callback(err);
                }

                let languageTypeCards = this.model.languageTypeCards;
                let uploadFilesForLanguageAndType = (languageAndTypeCard) => {
                    if (languageAndTypeCard.files.length === 0) {
                        if (languageTypeCards.length > 0) {
                            uploadFilesForLanguageAndType(languageTypeCards.shift())
                        } else {
                            return dsuBuilder.buildDossier(transactionId, callback);
                        }
                    }

                    let uploadPath = `${basePath}/${languageAndTypeCard.type.value}/${languageAndTypeCard.language.value}`;
                    this.uploadAttachmentFiles(transactionId, uploadPath, languageAndTypeCard.type.value, languageAndTypeCard.files, (err, data) => {
                        if (err) {
                            return callback(err);
                        }
                        if (languageTypeCards.length > 0) {
                            uploadFilesForLanguageAndType(languageTypeCards.shift())
                        } else {
                            return dsuBuilder.buildDossier(transactionId, callback);
                        }
                    });
                }
                return uploadFilesForLanguageAndType(languageTypeCards.shift())
            });
        });

    }

    uploadAttachmentFiles(transactionId, basePath, attachmentType, files, callback) {
        if (files === undefined || files === null) {
            return callback(undefined, []);
        }
        let xmlFiles = files.filter((file) => file.name.endsWith('.xml'))
        if (xmlFiles.length === 0) {
            return callback(new Error("No xml files found."))
        }
        let anyOtherFiles = files.filter((file) => !file.name.endsWith('.xml'))
        let responses = [];
        const uploadTypeConfig = {
            "leaflet": LEAFLET_ATTACHMENT_FILE,
            "smpc": SMPC_ATACHMENT_FILE
        }

        this.uploadFile(transactionId, basePath + uploadTypeConfig[attachmentType], xmlFiles[0], (err, data) => {
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

        product.creationTime = utils.convertDateToISO(Date.now());

        this.logService.log({
            logInfo:product,
            username: this.model.username,
            action: "Created product",
            logType: 'PRODUCT_LOG'
        });
        this.storageService.setItem(constants.PRODUCTS_STORAGE_PATH, JSON.stringify(this.products), callback);
    }

    persistKeySSI(keySSI, gtin, callback) {
        this.storageService.getItem(constants.PRODUCT_KEYSSI_STORAGE_PATH, "json", (err, keySSIs) => {
            if (typeof keySSIs === "undefined" || keySSIs === null) {
                keySSIs = {};
            }

            keySSIs[gtin] = keySSI;
            this.storageService.setItem(constants.PRODUCT_KEYSSI_STORAGE_PATH, JSON.stringify(keySSIs), callback);
        });
    }

    showLoadingModal() {
        this.showModal('loadingModal', {
            title: 'Loading...',
            description: 'We are creating your product right now ...'
        });
    }

    hideLoadingModal() {
        this.element.dispatchEvent(new Event('closeModal'));
    }
}