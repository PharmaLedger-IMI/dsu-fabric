import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import storage from "../services/Storage.js";
import constants from "../constants.js";
import utils from "../utils.js";

export default class batchesController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        this.setModel({});
        storage.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) =>{
            if (typeof batches === "undefined" || batches === null) {
                batches = [];
            }

            batches.forEach((batch)=>{
                batch.code = this.generateSerializationForBatch(batch);
            });
            this.model.batches = batches;
        });

        this.on("add-batch", () => {
            this.History.navigateToPageByTag("add-batch");
        });
    }

    generateSerializationForBatch(batch) {
        return `(01)${batch.gtin}(21)${batch.serialNumbers[0]}(10)${batch.batchNumber}(17)${batch.expiry}`;
    }
}
