import axios from 'axios';

export const getShippingRates = async (req, res) => {
  const {
    to_address,
    return_address,
    is_return = false,
    weight_unit = 'lbs',
    weight,
    length,
    width,
    height,
    size_unit = 'cm',
    items = [],
    package_type = 'Parcel',
    postage_types = [],
    signature_confirmation = true,
    insured = true,
    region = 'ON',
    tax_identifier,
  } = req.body;

  if (!to_address || !return_address || !weight || !length || !width || !height) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: to_address, return_address, weight, length, width, height',
    });
  }

  const payload = {
    to_address,
    return_address,
    is_return,
    weight_unit,
    weight,
    length,
    width,
    height,
    size_unit,
    items,
    package_type,
    postage_types,
    signature_confirmation,
    insured,
    region,
    ...(tax_identifier && { tax_identifier }),
  };

  try {
    const response = await axios.post('https://ship.stallionexpress.ca/api/v4/rates', payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.STALLION_API_KEY}`,
      },
    });
    console.log('🚀 response:', response.data);

    if (response.data.success) {
      res.json({
        status: 'success',
        data: {
          rates: response.data.rates,
          success: response.data.success,
        },
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to get shipping rates from Stallion API',
        details: response.data,
      });
    }
  } catch (error) {
    console.error('Stallion API Error:', error.response?.data || error.message);

    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || 'Failed to get shipping rates',
      details: error.response?.data,
    });
  }
};
