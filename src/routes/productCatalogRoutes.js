import express from 'express';
import { createProductCatalog } from '../controllers/productCatalog/createProductCatalog.js';
import { deleteProductCatalog } from '../controllers/productCatalog/deleteProductCatalog.js';
import { getAllProductCatalogs } from '../controllers/productCatalog/getAllProductCatalogs.js';
import { getProductCatalog } from '../controllers/productCatalog/getProductCatalog.js';
import { updateProductCatalog } from '../controllers/productCatalog/updateProductCatalog.js';

const router = express.Router();

router.route('/').get(getAllProductCatalogs).post(createProductCatalog);

router.route('/:id').get(getProductCatalog).put(updateProductCatalog).delete(deleteProductCatalog);

export default router;
