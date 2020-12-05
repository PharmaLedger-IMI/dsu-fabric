import constants from '../constants.js';
import StorageService from "./StorageService.js";

export default class LogService {

	constructor(dsuStorage) {
		this.storageService = new StorageService(dsuStorage);
	}

	log (logDetails) {
		if (logDetails === null || logDetails === undefined) {
			return;
		}
		this.getLogs((err, logs) => {
			if (err) {
				return console.log("Error retrieving logs.")
			}
			logs.push({
				...logDetails,
				timestamp: new Date().getTime()
			});
			this.storageService.setItem(constants.LOGS_STORAGE_PATH, JSON.stringify(logs), (err) => {
				if (err) {
					return console.log("Error adding a log.")
				}
			});
		})
	}

	getLogs (callback) {
		this.storageService.getItem(constants.LOGS_STORAGE_PATH, 'json', (err, logs) => {
			if (err) {
				return callback(err);
			}

			if (typeof logs === "undefined" || logs === null) {
				return callback(undefined, []);
			}
			callback(undefined, logs)
		});
	}
}