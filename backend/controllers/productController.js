const Product = require('../models/Product');

// ── Validation helper ──
const validateProduct = (body) => {
  const { name, item_type, hsn_sac_code, rate, gst_rate } = body || {};
  if (!name || !String(name).trim()) return 'Item Name is required';
  if (!item_type) return 'Item Type is required';
  if (rate === undefined || rate === '' || rate === null) return 'Rate is required';
  if (rate < 0) return 'Rate must be >= 0';
  // Products require HSN, Services require SAC
  if (item_type === 'Product' && hsn_sac_code && String(hsn_sac_code).trim()) {
    // ok
  }
  if (gst_rate === undefined || gst_rate === '' || gst_rate === null) return 'GST Rate is required';
  return null;
};

// GET /api/products
exports.getProducts = async (req, res, next) => {
  try {
    const { status, item_type, category, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (item_type) query.item_type = item_type;
    if (category) query.category = new RegExp(category, 'i');
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { hsn_sac_code: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') }
      ];
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

// POST /api/products
exports.createProduct = async (req, res, next) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const {
      item_type, name, hsn_sac_code, uom, rate, gst_rate,
      description, category, billing_type, status
    } = req.body;

    const product = await Product.create({
      item_type, name, hsn_sac_code, uom, rate, gst_rate,
      description, category, billing_type, status
    });

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res, next) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const {
      item_type, name, hsn_sac_code, uom, rate, gst_rate,
      description, category, billing_type, status
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.item_type = item_type;
    product.name = name;
    product.hsn_sac_code = hsn_sac_code;
    product.uom = uom;
    product.rate = rate;
    product.gst_rate = gst_rate;
    product.description = description;
    product.category = category;
    product.billing_type = billing_type;
    product.status = status;

    await product.save();
    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};