/*
*
* Storage Service that uses LocalStorage for now. In next iteration be replaced with a DSU storage service.
*
* */
export default {
	getItem: (keyName, format, callback) => {
		let value = localStorage.getItem(keyName);
		switch(format){
			case "json":
				try{
					value = JSON.parse(value);
				}catch(err){
					return callback(err);
				}
				break;
			default:
		}

		callback(undefined, value);
	},
	setItem: (keyName, value, callback) =>{
		if(typeof value === "object"){
			value = JSON.stringify(value);
		}
		localStorage.setItem(keyName, value);
		callback();
	}
}