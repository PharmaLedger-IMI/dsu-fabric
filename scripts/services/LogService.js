import storage from "./Storage.js";
import constants from '../constants.js';

let log = (logDetails) => {
	if (logDetails === null || logDetails === undefined) {
		return;
	}
	getLogs((err, logs) => {
		if (err) {
			return console.log("Error retrieving logs.")
		}
		logs.push({
			...logDetails,
			user: "<Username>",
			timestamp: new Date().getTime()
		});
		storage.setItem(constants.LOGS_STORAGE_PATH, JSON.stringify(logs), (err) => {
			if (err) {
				return console.log("Error adding a log.")
			}
		});
	})
}

let getLogs = (callback) => {
	storage.getItem(constants.LOGS_STORAGE_PATH, 'json', (err, logs) => {
		if (err) {
			return callback(err);
		}

		if (typeof logs === "undefined" || logs === null) {
			return callback(undefined, []);
		}
		callback(undefined, logs)
	});
}

export default {
	log: log,
	getLogs: getLogs
}