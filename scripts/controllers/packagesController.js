import ContainerController from '../../cardinal/controllers/base-controllers/ContainerController.js';
import storage from '../services/Storage.js';
import constants from '../constants.js';

export default class packagesController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        this.setModel({});
        storage.getItem(constants.PACKAGES_STORAGE_PATH, "json", (err, packs) => {
            if (err) {
                console.log(err);
            }

            if (typeof packs === "undefined" || packs === null) {
                packs = [];
            }

            packs.forEach((pack)=>{
                pack.code = this.generateSerializationForPack(pack);
            });
            this.model.packs = packs;
        });

        this.on("create-package", () => {
            this.History.navigateToPageByTag("create-package");
        });
    }

    generateSerializationForPack(pack) {
        let serialization = `(01)${pack.gtin}(21)${pack.serialNumber}(10)${pack.batch}(17)${pack.expiryForDisplay}`;
        return serialization;
    }
}
