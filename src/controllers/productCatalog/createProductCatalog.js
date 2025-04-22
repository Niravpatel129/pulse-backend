import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';

export const createProductCatalog = async (req, res, next) => {
  try {
    const { name, quantity, price, projects, modules, discount } = req.body;

    const product = await ProductCatalog.create({
      name,
      discount,
      quantity,
      price,
      projects: projects || [],
      modules: modules || [],
    });

    res.status(201).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    next(new AppError(`Failed to create product catalog: ${error.message}`, 400));
  }
};
