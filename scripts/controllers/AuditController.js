import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import storage from "../services/Storage.js";
import LogService from "../services/LogService.js";

export default class AuditController extends ContainerController {
    constructor(element, history) {
        super(element, history);

        this.setModel({});

        this.model.addExpression('logListLoaded',  () => {
            return typeof this.model.logs !== "undefined";
        }, 'logs');

        LogService.getLogs((err, logs) => {
            if(err){
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