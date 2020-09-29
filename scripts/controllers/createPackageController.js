import ContainerController from '../../cardinal/controllers/base-controllers/ContainerController.js';
import Package from '../models/Package.js';
import GTIN_DSU_Builder from "../services/GTIN_DSU_Builder.js";
import Batch from "../models/Batch.js";
import Countries from "../models/Countries.js";
import storage from "../services/Storage.js";
import constants from "../constants.js";

const gtin_dsu_builder = new GTIN_DSU_Builder();

export default class createPackageController extends ContainerController {
    constructor(element, history) {
        super(element);

        this.setModel({});
        this.model.package = new Package();

        storage.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) => {
            if(err){
                return console.log("Error", err);
            }

            if(batches === null || typeof batches === "undefined"){
                batches = [];
            }

            let options = [];
            batches.forEach(batch => options.push(new Batch(batch).generateViewModel()));
            this.model.batches = {
                label: "Batch",
                placeholder: "Select a batch",
                options: options
            };
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });

        this.model.onChange("batches.value", (event)=>{
            storage.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) => {
                let batch = batches.find(batch => batch.batchNumber === this.model.batches.value);
                this.model.expiration = batch.expiration;
                this.model.country = Countries.getCountry(batch.country);
                this.model.selectedBatch = batch;

                storage.getItem(constants.PRODUCTS_STORAGE_PATH, "json", (err, products) => {
                    if(err){
                        console.log(err);
                    }

                    if(Array.isArray(products)){
                        let product = products.find((product)=>{
                            return product.keySSI === batch.product;
                        });

                        this.model.gtin = product.gtin;
                    }
                })
            });
        })

        this.on("save-package", (event) => {
            let pack = {gtin: this.model.gtin, batch: this.model.selectedBatch.batchNumber, product: this.model.selectedBatch.keySSI};
            let expirationDate = new Date(this.model.selectedBatch.expiration);
            const ye = new Intl.DateTimeFormat('en', { year: '2-digit' }).format(expirationDate);
            const mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(expirationDate);
            const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(expirationDate);
            pack.expiration = `${ye}${mo}${da}`;

            this.buildPackageDSU(pack, (err, gtinSSI)=>{
                if (err) {
                    this.showError(err, "PackageDSU build failed.");
                    return;
                }
                console.log("Package was created.", gtinSSI);
                pack.keySSI = gtinSSI;
                pack.serialNumber = this.model.package.serialNumber;
                this.persistPack(pack, (err) => {
                    if(err){
                        this.showError(err, "Persist Package failed.");
                    }
                    history.push("?packages");
                });
            });
        });
    }

    buildPackageDSU(pack, callback) {
        gtin_dsu_builder.getTransactionId((err, transactionId)=>{
            if(err){
                return callback(err);
            }
            gtin_dsu_builder.setGtinSSI(transactionId, constants.DOMAIN_NAME, pack.gtin, pack.batch, pack.expiration,(err)=>{
                if(err){
                    return callback(err);
                }
                gtin_dsu_builder.addFileDataToDossier(transactionId, "package", JSON.stringify(pack), (err)=>{
                    if (err) {
                        return callback(err);
                    }
                    gtin_dsu_builder.mount(transactionId, "/batch", pack.product, (err)=>{
                        if(err){
                            return callback(err);
                        }

                        gtin_dsu_builder.buildDossier(transactionId, callback);
                    });
                });
            });
        });
    }

    persistPack(pack, callback){
        storage.getItem(constants.PACKAGES_STORAGE_PATH, 'json', (err, packs) => {
            if (err) {
                //todo: improve error handling here
               return callback(err);
            }

            if (typeof packs === "undefined" || packs === null) {
                packs = [];
            }

            packs.push(pack);
            storage.setItem(constants.PACKAGES_STORAGE_PATH, JSON.stringify(packs), callback);
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
