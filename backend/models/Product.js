const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  companyId: {
    type: String,
    default: 'company_madhura',
    index: true
  },
  item_type: {
    type: String,
    enum: ['Product', 'Service'],
    default: 'Product'
  },
  name: {
    type: String,
    required: [true, 'Item Name is required'],
    trim: true
  },
  hsn_sac_code: {
    type: String,
    default: '',
    trim: true
  },
  uom: {
    type: String,
    default: 'Nos',
    trim: true
  },
  rate: {
    type: Number,
    default: 0,
    min: [0, 'Rate must be >= 0']
  },
  gst_rate: {
    type: Number,
    default: 18,
    min: [0, 'GST Rate must be >= 0']
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    default: '',
    trim: true
  },
  billing_type: {
    type: String,
    enum: ['One-time', 'Monthly', 'Yearly'],
    default: 'One-time'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);