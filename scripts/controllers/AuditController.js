import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import LogService from "../services/LogService.js";

export default class AuditController extends ContainerController {
    constructor(element, history) {
        super(element, history);

        this.setModel({});

        this.model.addExpression('logListLoaded', () => {
            return typeof this.model.logs !== "undefined";
        }, 'logs');

        this.model.addExpression('listHeader', () => {
            return typeof this.model.logs !== "undefined" && this.model.logs.length > 0;
        }, 'logs');

        this.on("show-keySSI", (event) => {
            this.showModal('viewKeySSIModal', {keySSI: event.data}, () => {});
        });

        LogService.getLogs((err, logs) => {
            if (err) {
                //todo: implement better error handling
                //throw err;
            }
            if (typeof logs === "undefined" || logs === null) {
                logs = [];
            }
            this.model.logs = logs;
        })
    }
}