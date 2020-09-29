import Utils from "./Utils.js";

export default class Product {
	name = "";
	gtin = "";
	photo = "assets/images/default.png";
	description = "";
	leaflet = "";

	constructor(product) {
		if(typeof product !== undefined){
			for(let prop in product){
				this[prop] = product[prop];
			}
		}
	}

	validate(){
		const errors = [];
		if (!this.name) {
			errors.push('Name is required.');
		}

		if (!this.gtin) {
			errors.push('Product Type Serial Number is required.');
		}

		return errors.length === 0 ? true : errors;
	}

	generateViewModel(){
		return {label:this.name, value: this.gtin}
	}
}