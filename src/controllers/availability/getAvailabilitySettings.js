import Availability from '../../models/Availability.js';

const getAvailabilitySettings = async (req, res) => {
  try {
    const { userId } = req.user;
    let availabilitySettings = await Availability.findOne({ userId });

    if (!availabilitySettings) {
      availabilitySettings = new Availability({ userId });
    }

    res.status(200).json(availabilitySettings);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error retrieving availability settings', error: error.message });
  }
};

export default getAvailabilitySettings;
