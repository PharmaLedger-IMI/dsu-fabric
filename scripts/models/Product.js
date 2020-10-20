import Utils from "./Utils.js";

export default class Product {
	name = "";
	gtin = "";
	photo = "assets/images/default.png";
	description = "";
	leaflet = "";
	manufName = "Novartis Pharmaceuticals Corporation";
	files = [];

	constructor(product) {
		if(typeof product !== undefined){
			for(let prop in product){
				this[prop] = product[prop];
			}
		}

		if (this.gtin === "") {
			this.gtin = Utils.generateNumericID(14);
		}
	}

	validate(){
		const errors = [];
		if (!this.name) {
			errors.push('Name is required.');
		}

		if (!this.gtin) {
			errors.push('GTIN is required.');
		}

		return errors.length === 0 ? true : errors;
	}

	generateViewModel(){
		return {label:this.name, value: this.gtin}
	}
}