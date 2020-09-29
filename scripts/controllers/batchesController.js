import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import Batch from "../models/Batch.js";
import storage from "../services/Storage.js";
import constants from "../constants.js";

export default class batchesController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        storage.getItem(constants.BATCHES_STORAGE_PATH, "json", (err, batches) =>{
            const model = {batches: []};
            if (batches) {
                batches.forEach(batch => model.batches.push(new Batch(batch)));
            }

            this.setModel(model);
        });

        this.on("add-batch", () => {
            history.push("?add-batch");
        });
    }
}
