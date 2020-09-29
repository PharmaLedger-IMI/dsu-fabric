import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import storage from "../services/Storage.js";

export default class ProductsController extends ContainerController {
	constructor(element, history) {
		super(element, history);

		this.setModel({});

		this.model.addExpression('productsListLoaded',  () => {
			return typeof this.model.products !== "undefined";
		}, 'products');

		console.log("Preparing to set up the view model");
		storage.getItem(constants.PRODUCTS_STORAGE_PATH, 'json', (err, products) => {
			if(err){
				//todo: implement better error handling
				//throw err;
			}

			if(typeof products === "undefined"){
				return this.model.products = [];
			}

			this.model.products = products;
		});

		this.on("add-product", (event)=>{
			event.stopImmediatePropagation();
			//this.History.navigateToPageByTag("manage-product");
			history.push("?manage-product");
		});

		this.on("edit-product", (event)=>{
			let target = event.target;
			let targetLabel = target.getAttribute("label");
			const regex = /[\d]+/gm;
			const index = regex.exec(targetLabel);

			history.push({
				pathname: '?manage-product',
				state: {
					productIndex: Array.isArray(index) ? index[0] : index
				}
			});
		}, {capture: true});

		this.on("view-drug", (event)=>{
			history.push("?drug-details");
		});

		this.on('openFeedback', (e) => {
			this.feedbackEmitter = e.detail;
		});
	}
}